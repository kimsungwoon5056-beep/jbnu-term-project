import { Subject } from '../lib/subject'
import * as firebaseNet from './net'
import { applyRemote, spawnEvent } from './world'

// Adapter: 대결 루프가 기대하는 통신 창구(RoomChannel)와, 그 모양에 맞춘 구현들.
//
// RoomChannel(Target) — 루프와 linkWorld는 이것만 안다.
//   now()         서버 기준 지금 시각(ms). 온라인 판의 시간을 모두 같게 맞춘다.
//   sendState(s)  내 위치·체력 { x, y, a, hp, alive } 보내기
//   sendEvent(ev) 내 시전·아이템 줍기 { k, o, x, y, a, ... } 보내기
//   onEvent(fn)   다른 사람의 이벤트 받기 → 해지 함수
//   onPeers(fn)   참가자 상태 묶음 { [uid]: s | null } 받기(방에서 나간 사람은 빠진다) → 해지 함수
//   onConnection(fn) 연결됨(true)·끊김(false) 받기. 처음 연결된 뒤의 변화만 → 해지 함수
//   close()       구독을 모두 끊는다
//
// FirebaseRoomChannel(Adapter): Firebase Realtime Database 래퍼(net.js, Adaptee)의 함수 이름·인자·데이터 모양을
//   RoomChannel에 맞춘다. 방 코드·내 uid를 들고 있어 루프는 그것을 몰라도 된다.
// MemoryRoom(같은 인터페이스의 메모리 구현): 두 화면을 한 프로세스에서 이어 동기화를 자동으로 시험한다.

export class FirebaseRoomChannel {
  constructor(code, uid, net = firebaseNet) {
    this.code = code
    this.uid = uid
    this.net = net
    this.offset = 0 // 서버 시각과 내 시계의 차이(ms)
    this.offs = [net.watchServerOffset((value) => (this.offset = value))]
  }

  now() {
    return Date.now() + this.offset
  }

  // 보낸 시각(서버 기준 내 시계)을 붙인다. 서버가 받은 시각은 네트워크 사정으로 들쭉날쭉해 속도 계산이 튄다.
  sendState(s) {
    this.net.sendState(this.code, this.uid, { t: this.now(), ...s })
  }

  sendEvent(ev) {
    this.net.sendEvent(this.code, { ...ev, t: this.now() })
  }

  onEvent(fn) {
    return this.track(this.net.watchEvents(this.code, this.uid, fn))
  }

  // net.watchRoom은 { meta, players: { uid: { name, ready, loadout, s } } }를 준다 → 상태(s)만 골라 넘긴다.
  onPeers(fn) {
    return this.track(
      this.net.watchRoom(this.code, ({ players }) => fn(Object.fromEntries(Object.entries(players ?? {}).map(([id, player]) => [id, player?.s ?? null])))),
    )
  }

  onConnection(fn) {
    let first = true // 구독하자마자 오는 "아직 연결 전"은 끊긴 것이 아니다.
    const watch = this.net.watchConnected
    if (!watch) return () => {}
    return this.track(
      watch((connected) => {
        if (first && !connected) return
        if (!first || !connected) fn(connected)
        first = false
      }),
    )
  }

  close() {
    for (const off of this.offs) off()
    this.offs = []
  }

  track(off) {
    this.offs.push(off)
    return () => {
      off()
      this.offs = this.offs.filter((item) => item !== off)
    }
  }
}

// 메모리 안의 방: 같은 방에 들어온 창구끼리 이벤트·상태를 바로 주고받는다(시험용, 서버 없음).
export class MemoryRoom {
  constructor({ now = () => 0 } = {}) {
    this.clock = now
    this.channels = new Map()
    this.states = {}
  }

  join(uid) {
    const channel = new MemoryRoomChannel(this, uid)
    this.channels.set(uid, channel)
    this.states[uid] = null
    this.broadcastPeers()
    return channel
  }

  leave(uid) {
    this.channels.delete(uid)
    delete this.states[uid]
    this.broadcastPeers()
  }

  broadcastPeers() {
    for (const channel of this.channels.values()) channel.peers.notify({ ...this.states })
  }
}

class MemoryRoomChannel {
  constructor(room, uid) {
    this.room = room
    this.uid = uid
    this.events = new Subject()
    this.peers = new Subject()
  }

  now() {
    return this.room.clock()
  }

  sendState(s) {
    this.room.states[this.uid] = { t: this.room.clock(), ...s }
    this.room.broadcastPeers()
  }

  // 다른 사람에게만 보낸다(내 이벤트는 이미 내 화면에 있다).
  sendEvent(ev) {
    for (const [uid, channel] of this.room.channels) if (uid !== this.uid) channel.events.notify({ ...ev, t: this.room.clock() })
  }

  onEvent(fn) {
    return this.events.subscribe(fn)
  }

  onPeers(fn) {
    return this.peers.subscribe(fn)
  }

  close() {
    this.room.leave(this.uid)
  }
}

// Client 쪽 연결: 창구에서 받은 것을 내 화면의 world에 반영한다. 해지 함수를 돌려준다.
//   다른 사람의 이벤트 → spawnEvent(같은 이벤트면 어느 화면에서나 같은 발사체·아이템 줍기). 늦게 받은 만큼 앞당긴다.
//   참가자 상태 → applyRemote(위치·체력). 오는 동안 움직였을 만큼 예측한다. 방에서 빠진 사람은 쓰러진 것으로 본다.
const lateOf = (channel, t) => (Number.isFinite(t) ? (channel.now() - t) / 1000 : 0)

// 받을 이벤트인지: 끝난 판, 이 판에 없는 사람, 쓰러진 사람이 뒤늦게 보낸 것, 끊겼다가 몰려온 옛 공격은 버린다.
// 아이템 줍기는 늦게 와도 받는다(받지 않으면 이미 없어진 아이템이 내 화면에만 남는다).
export const STALE = 1.2
function acceptEvent(world, ev, late) {
  const owner = world.players.find((player) => player.id === ev.o)
  if (world.over || !owner) return false
  if (ev.k === 'pick') return true
  return owner.alive && late <= STALE
}

export function linkWorld(world, channel, meId) {
  const offEvents = channel.onEvent((ev) => {
    const ahead = lateOf(channel, ev.t)
    if (acceptEvent(world, ev, ahead)) spawnEvent(world, ev, { ahead })
  })
  const offPeers = channel.onPeers((peers) => {
    const now = channel.now()
    for (const player of world.players) {
      if (player.id === meId) continue
      if (player.id in peers) applyRemote(world, player.id, peers[player.id], { now })
      else applyRemote(world, player.id, { x: player.x, y: player.y, alive: false })
    }
  })
  return () => {
    offEvents()
    offPeers()
  }
}
