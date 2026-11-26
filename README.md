# 디톡스 PVP

**폰을 내려놓은 사람이 이긴다.**

2026학년도 2학기 초급프로젝트(일반 분반) Term Project 저장소입니다.
스마트폰 과의존을 줄이도록 돕는 앱입니다. 가입할 때 나를 닮은 도트 캐릭터를 만들고, 매일 스크린 타임(화면 시간·앱 종류·많이 쓴 앱·화면 깨우기·알림)과 걸음 수를 기록하면
많이 쓴 앱이 캐릭터의 머리·옷·손에 스며들고, 폰을 많이 쓸수록 얼굴·눈·자세·배경이 바뀌며 디지털 건강이 떨어집니다.
React로 화면을 만들고 Firebase로 로그인과 데이터를 관리하며, 빌드 결과를 JCloud에 배포합니다.

> 캐릭터에 스며드는 앱 색·미니 로고는 카카오톡·인스타그램·유튜브 등 많이 쓰는 앱의 아이콘을 닮게 도트로 그렸습니다. 이 저장소와 배포 사이트는 비상업 교육용 과제이며, 앱 이름·로고의 권리는 각 회사에 있습니다.

## 지금 되는 기능

- 이메일/비밀번호 회원가입·로그인·로그아웃. 회원가입은 2단계로, 2단계에서 **나를 닮은 모습**(닉네임·피부색·머리 모양·머리색·안경)을 미리보기와 함께 고릅니다. 실명·생년월일·키·몸무게는 받지 않습니다(`src/profile/`). 모습은 아래 독의 "내 모습"에서 언제든 고칠 수 있습니다.
- 하루 기록 등록·조회·수정·삭제: 스마트폰 사용과 걸음 수만 기록합니다. 홈에는 최근 기록 7개가 보입니다.
- 캡처로 불러오기: 아이폰 스크린 타임·안드로이드 디지털 웰빙·건강 앱 캡처를 브라우저 안에서 글자 읽기(tesseract.js)로 읽어 칸을 채웁니다. 사진은 저장하지 않습니다(`src/capture/`).
- 앱이 스며든 캐릭터(`src/character/`): 오늘 화면 시간이 1시간 30분·3시간·5시간을 넘을 때마다 많이 쓴 앱 1·2·3위가
  - 머리(앱 색으로 물든 내 머리 + 미니 로고 핀, 또는 유튜브·쿠팡 모자, 배민 헬멧, 디스코드·게임·음악 헤드셋, 넷플릭스·틱톡 후드),
  - 옷(앱 색 후드티 + 가슴 로고),
  - 손(앱 화면이 켜진 폰, 6시간 넘으면 얼굴 옆까지 들어 올림)에 스며듭니다. 앱 12개는 아이콘을 닮은 로고, 그 밖의 앱은 유형 9가지 모양을 씁니다.
- 중독 정도가 드러나는 곳: 얼굴색·볼(디지털 건강), 빙글빙글 눈(화면 깨우기 100번 이상), 다크서클(밤 0~4시에 처음 폰을 깨움), 화면 빛(영상·게임), 거북목(4시간 이상), 머리 위 알림 배지(100·200·300개), 운동화·슬리퍼(걸음), 배경(햇살 공원·낮의 방·어두운 방), 칭호("인스타에 잠긴 나", "폰 내려놓기 고수" 등)
- 같은 모습 + 같은 사용이면 누구나 같은 캐릭터입니다. 계정 ID는 그림에 쓰지 않습니다.
- 디지털 건강(%): 100 × (1 − 화면 시간 0.30 − 걸음 부족 0.20 − 밤 폰 0.15 − 화면 깨우기 0.15 − 알림 0.10의 문제 정도 합), 10~100%. 상태 표시줄 배터리가 곧 디지털 건강입니다(`src/stats/health.js`).
- 잠금 화면 알림 = 부위 설명: 오늘의 상태가 잠금 화면 푸시 알림 카드로 쌓이고, 알림이나 캐릭터의 부위를 누르면 그 부위가 반짝이며 오늘 숫자로 된 이유와 다음 목표가 펼쳐집니다(`src/character/reasons.js`, `LockNotices.jsx`).
- 도트 스마트폰 화면: 상태 표시줄, 잠금 화면 시계, 디지털 건강·스크린 타임 위젯, 푸시 알림, 아래 독(`src/ui/PhoneFrame.jsx`).
- 기록 규칙: 새 기록은 오늘·어제만, 수정·삭제는 7일 이내. 화면을 켜 둔 채 자정이 지나면 "오늘"이 바뀝니다.
- 실패를 숨기지 않습니다: 저장·불러오기 실패는 이유와 함께 보여 주고(불러오기는 "다시 불러오기"), 범위를 넘는 숫자는 최댓값으로 맞추며 칸 아래에 알려 줍니다. 대결 결과 화면에는 전적 저장 성공·실패가 나옵니다.
- **실시간 대결(최대 4명, `src/battle/`)**: 오늘의 캐릭터로 아레나에서 개인전을 합니다. 기본 화면은 직접 만든 광선 투사(raycasting)로 그리는 1인칭 3D입니다(`firstPerson/`).
  - 한 사람당 목숨 3개: 쓰러지면 3초 뒤 처음 자리에서 가장 가까운 켜진 자리에서 다시 시작하고(2초 무적), 마지막 목숨까지 잃으면 아웃입니다. 마지막까지 남거나, 5분이 끝났을 때 남은 목숨·체력이 가장 많은 사람이 이깁니다.
  - 경기장은 거대한 세로 폰 홈 화면입니다. 맨 위 상태 표시줄의 시계가 남은 시간, 앱 아이콘이 장애물, 맨 아래 독이 내 상태 칸(대시·Q 근접 기술·E 원거리 기술 재사용 대기, 남은 목숨, 아이템 효과)입니다.
  - 판 중간 사건:
    - 아이템(12초마다): 비행기 모드(2초 무적), 충전기(체력 +15), 방해 금지(8초 동안 알림 폭풍·알림 배지 멈칫 무시)
    - 알림 폭풍(약 46초마다 5번): 경고 뒤 알림 말풍선이 줄을 따라 쏟아집니다. 맞으면 피해와 멈칫이 생기고, 점프로는 넘지 못합니다.
    - 배터리 경고(3분부터, 4분 30초에 가장 좁음): 가장자리부터 화면이 꺼지며 좁혀 옵니다. 꺼진 곳에 있으면 체력이 깎입니다.
    - 일정은 씨앗(온라인은 방 코드 + 방을 만든 시각)으로 정해서, 모든 화면에서 같은 시각·자리에 같은 일이 생깁니다(`schedule.js`).
  - **앱 속으로(모드 12가지, `modes/`)**: 8초부터 약 23초마다 한 번(한 판에 12번, 10초씩) 모두의 화면이 같은 앱 속으로 들어갑니다. 보는 법과 규칙이 번갈아 바뀌고, 12가지가 한 번씩 나오며 순서는 씨앗이 정합니다.
    - 보는 법: 지도 앱(위에서 내려다보는 2D), 영상통화(상대의 눈으로 나를 봄), 추격 카메라(등 뒤 3인칭), 자동 회전, 셀카(앞 카메라로 나를 마주 봄, 좌우 반전, 맞으면 굴욕 사진), 손전등(가운데 빛만 보임), 저전력(초록 저화질)
    - 규칙: 짧은 영상(바닥을 쓸고 오는 넘기기 파도를 점프로 넘기), 광고(건너뛰기를 먼저 밟기), 음악(박자에 맞춰 공격하면 피해 2배), 앱 업데이트(공격·기술이 서로 바뀜), 알고리즘 보스(함께 때리고 가장 많이 때린 사람이 회복)
    - 모드 그림은 세계 자리를 지금 화면 자리로 바꾸는 함수 하나(`Renderer.project`)만 써서 1인칭·지도 앱에서 같은 코드로 그립니다. 보는 법만 바뀌는 모드는 이동·피해 계산이 그대로라 결과가 화면마다 달라지지 않습니다.
    - 연습에서는 "앱 속으로"에서 원하는 모드를 골라 볼 수 있습니다.
  - 모션: 캐릭터를 관절 인형(머리·몸통·팔·다리)으로 나누어 걷기·무기 휘두르기(모양마다 다른 팔 궤적)·맞기·기술·쓰러지기를 그립니다(`rig.js`, `motions.js`). 맞으면 의성어·액정 금·얼굴에 붙는 알림, 쓰러지면 로그아웃 묘비가 나옵니다.
  - 효과음 28가지는 zzfx로 그 자리에서 합성합니다(`src/audio/`). 배경음악 3곡도 그 자리에서 연주합니다(직접 지은 곡, `src/audio/music.js`). 소리·음악·움직임은 설정에서 끄고 켤 수 있고, 움직임은 처음에 기기의 "동작 줄이기" 설정을 따릅니다.
  - 로비: 앱 아이콘이 떨어져 쌓이고(matter-js), 끌어 던지거나 눌러 지울 수 있습니다. 결과 화면에는 1~3위 단상·색종이와 다음 판 조언이 나옵니다.
  - 오늘의 대결 능력:
    - 체력 = 60 + 40 × 디지털 건강
    - 운동화(8,000보 이상)면 속도 +20%
    - 무기·기술은 머리에 스며든 1위 앱 유형에서 나옵니다. 폰이 그 앱의 무기로 변해 근접 연속기를 씁니다(무기 11종: 하트 채찍, 재생바 창, 마이크 해머, 패드 쌍검, 컷 대검, 택배 망치, 카드 단검, 연필 레이피어 등, `melee.js`). 공격마다 준비(예고)→타격→회복이 있고, 큰 공격은 바닥에 빨간 맞을 자리가 미리 보입니다. Q는 모션이 다른 근접 기술 11종(읽씹 태클, 좋아요 회오리, 되감기, 드롭, 필살 콤보, 컷 전환, 당일 배송, 손절 반격, 벼락치기 등, `skills.js`), E는 18초에 한 번 쓰는 원거리 기술입니다(`farSkills.js`). 앱 조각이 없으면 가장 강한 "디톡스 실드"를 씁니다.
    - 디버프: 알림 배지(10초마다 멈칫), 빙글 눈(조준 흔들림), 다크서클(시야 좁아짐), 거북목(대시 짧아짐)
    - 오늘 스마트폰 기록이 없으면 건강 50%로 보고 앱 기술이 없습니다.
  - 조작: PC는 WASD 이동(보는 방향 기준), 마우스로 둘러보기·클릭 근접 공격(누르고 있으면 연속기), 오른쪽 클릭·F 막기, Space 점프, Shift 대시, Q 근접 기술, E 원거리 기술입니다. 휴대폰은 왼쪽 조이스틱으로 움직이고, 공격 버튼을 누른 채 좌우로 밀면 휘두르면서 둘러봅니다(누르고만 있으면 가까운 상대 쪽으로 조준을 도움). 화면이나 스틱 옆 빈 곳을 밀어도 둘러보고, 막기·점프·대시·기술 버튼을 씁니다. 지도 앱 동안은 화면 방향으로 움직이고 마우스로 조준합니다.
    - 점프: 최고 높이 약 40, 체공 약 0.6초. 높이 떠 있는 동안은 탄·덫·충격파와 바닥을 내려찍는 공격이 아래로 지나갑니다. 땅에 내리자마자 다시 뛸 수 있습니다(내린 직후 0.15초는 조금 느림).
    - 막기·패링(`guard.js`): 누르면 0.6초 동안 무기를 들어 앞(보는 방향 ±80°)을 막습니다. 막으면 피해가 30%로 줄고 밀림·멈칫·출혈이 없습니다. 자세를 잡고 0.2초 안에 맞으면 패링: 피해가 없고, 가까이 있던 상대는 0.7초 멈칫하며 휘두르던 공격이 튕겨 나갑니다. 다시 쓰기 1.2초(패링하면 바로). 내 공격 중에 누르면 그 타가 끝나자마자 막습니다. 판정은 맞는 쪽 화면이 하고, 자세와 패링은 시전 이벤트(g 1·2)로 알립니다.
  - 온라인: 방 만들기 → 4자리 코드나 초대 링크(`?room=코드`) 공유 → 참가 → 준비 → 방장이 시작합니다.
    - Firebase Realtime Database로 위치·높이·체력·남은 목숨을 초당 20번, 공격은 바로 주고받습니다. 상대 위치는 움직이던 속도로 조금 앞을 예측해 그리고, 늦게 받은 공격은 늦은 만큼 앞당깁니다.
    - 맞았는지는 맞는 쪽 화면이 판정합니다.
    - 판 중에 연결이 끊기거나 6초 넘게 소식이 없으면 모든 화면에서 마지막 소식의 때에 아웃이고, 대기실에서 끊겼다 돌아오면 다시 들어갑니다. 완전히 같은 결과는 무승부입니다.
  - 연습: 시연 인물 캐릭터 봇 1~3명과 겨룹니다(인터넷 연결 없이). 봇은 성격이 둘입니다: 두 타를 치고 빠지는 kiter, 붙어서 연속기를 끝까지 치는 rusher. 둘 다 상대의 준비 동작을 보고 피하고, 멀면 가끔 E를 씁니다.
  - 전적: 판이 끝나면 `users/{uid}/matches`에 순위가 저장되고, 대결 화면에 "N판 M승"과 최근 5판으로 보입니다. 전적은 한 번 쓰면 고치거나 지울 수 없습니다(승패 기록을 나중에 바꿔 "N판 M승"을 부풀리지 못하게).
- 개발 서버에서 `http://localhost:5173/?gallery`를 열면 앱 21종 × 머리·옷·손, 머리 모양, 상태 표시 견본을 한 번에 볼 수 있습니다(배포 빌드에는 포함되지 않음).

## 기술 구성

- React 19 + Vite
- Firebase Authentication, Cloud Firestore, Realtime Database(실시간 대결)
- Vitest (단위·화면 테스트, 화면 테스트는 jsdom + Testing Library)
- oxlint (린트)
- GitHub Actions (린트·테스트·빌드 자동 검사)
- 오픈소스 라이브러리
  - [matter-js](https://github.com/liabru/matter-js) 0.20.0 (MIT): 로비에 떨어지는 앱 아이콘의 물리
  - [zzfx](https://github.com/KilledByAPixel/ZzFX) 1.4.0 (MIT): 효과음 합성
  - [canvas-confetti](https://github.com/catdad/canvas-confetti) 1.9.4 (ISC): 승리 색종이
  - [tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0): 캡처 글자 읽기
- 글꼴: [Galmuri](https://github.com/quiple/galmuri) (Galmuri11, SIL Open Font License 1.1, npm `galmuri`)

## 실행 방법

Node.js 24 이상이 필요합니다.

```sh
npm ci          # 의존성 설치
npm run dev     # 개발 서버 실행
npm test        # 단위 테스트
npm run lint    # 린트
npm run build   # 배포용 빌드 (dist/)
```

## Firebase 설정

1. Firebase 콘솔에서 Authentication의 **이메일/비밀번호** 로그인을 사용 설정합니다.
2. Firestore 데이터베이스를 프로덕션 모드로 만듭니다(위치: `asia-northeast3`).
   실시간 대결용 Realtime Database는 잠금 모드로 만듭니다(위치: `asia-southeast1`). 데이터 탭 맨 위의 주소를 `.env.local`의 `VITE_FIREBASE_DATABASE_URL`에 넣습니다. 없으면 대결 화면에서 연습만 할 수 있습니다.
3. 프로젝트 설정 > 내 앱 > 웹 앱의 `firebaseConfig` 값을 확인합니다.
4. `.env.example`을 `.env.local`로 복사하고 값을 채웁니다.

```sh
cp .env.example .env.local
```

`.env.local`이 없으면 화면에 설정 안내가 나타납니다.

| 환경 변수 | 값 |
|---|---|
| `VITE_FIREBASE_API_KEY` | 웹 앱 `firebaseConfig.apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `firebaseConfig.authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `firebaseConfig.projectId` |
| `VITE_FIREBASE_APP_ID` | `firebaseConfig.appId` |
| `VITE_FIREBASE_DATABASE_URL` | Realtime Database 주소(실시간 대결용, 없으면 연습만) |

### 데이터 구조와 Security Rules

| 경로 | 내용 | 접근 |
|---|---|---|
| `users/{uid}` | nickname, look { skin, hairStyle, hairColor, glasses }, updatedAt | 본인만 |
| `users/{uid}/matches/{id}` | mode(practice·online), rank, players, names[], date, createdAt | 본인만. 새로 만들기만(승패 조작 방지) |
| `users/{uid}/records/{YYYY-MM-DD}` | date, phone { total, categories, topApps[], pickups, firstPickup, pickupApps[], notifications, notifyApps[] }, steps, updatedAt | 본인만 |

규칙은 `firestore.rules`에 있습니다. 본인 문서만 읽고 쓸 수 있고, 새 기록은 한국 시간 기준 오늘·어제만, 수정·삭제는 7일 이내만 허용하며, 필드 이름과 값 범위를 검사합니다(예전 기록의 수면·운동 등 필드가 들어간 요청은 거절). 모습은 정해진 값만, 닉네임은 2~10자만 허용합니다. 규칙에는 반복문이 없어 앱 목록 안 항목별 값은 앱(`src/records/record.js`)에서 검사합니다.

실시간 대결은 Realtime Database `rooms/{코드}`를 씁니다(코드는 헷갈리는 글자 0·O·1·I·L을 뺀 4자리).

| 경로 | 내용 |
|---|---|
| `rooms/{코드}/meta` | host, status(waiting → playing → ended), createdAt, startAt |
| `rooms/{코드}/slots/{0~3}` | 자리마다 참가자 uid |
| `rooms/{코드}/players/{uid}` | name, ready, loadout(대결 능력·모습, 시작 후 고정), s { x, y, z(높이), a, hp, alive, l(남은 목숨), t } |
| `rooms/{코드}/events/{id}` | 근접 공격·기술·아이템 줍기 { k: shot·skill·pick, o, x, y, a, s?(무기·기술 열쇠), c?(연속기 타 번호·반격), e?(E 원거리), g?(막기 1·패링 2), p?(패링당한 사람), m?, i?, t } |

규칙은 `database.rules.json`에 있습니다.
- 방 정보(meta)와 자리(slots)는 로그인한 사람만 읽습니다. 참가자·공격 기록은 그 방 참가자만 읽습니다.
- 자리는 빈 칸에만 내 uid로 쓸 수 있어 5번째 참가는 거절됩니다.
- 내 칸만 쓸 수 있습니다. 시작 뒤에는 대결 능력을 바꿀 수 없고, 체력은 줄기만 합니다. 회복(디톡스 실드·충전기·다시 시작)은 시작할 때의 최대 체력까지만 오를 수 있습니다. 남은 목숨(0~3)은 판 중에 늘 수 없습니다.
- 방 상태는 대기 → 진행 → 끝으로만 바뀝니다.

규칙을 바꾼 뒤에는 Firebase에 올립니다(처음 한 번 `npx firebase-tools login` 필요).

```sh
npm run deploy:rules
```

- 순서: 규칙을 먼저 올리고 앱을 올립니다. 옛 규칙은 모르는 칸(`z`·`l`)이 있는 상태를 거절해, 새 앱만 올리면 모두 "소식 없음"으로 아웃됩니다. 옛 앱(목숨 1개)과 새 앱은 한 방에서 함께 대결할 수 없으니 둘 다 새로 받은 뒤 대결합니다.

## 배포

같은 빌드(`dist/`)를 두 곳에 올립니다. 빌드할 때 `.env.local`의 Firebase 설정값이 함께 들어가므로, 배포 전에 `.env.local`이 있어야 합니다.

| 위치 | 용도 | 명령 |
|---|---|---|
| JCloud (Ubuntu + Nginx) | 과제 제출용 주소(http://s.jedutools.io:21059) | `npm run deploy:jcloud` |
| Firebase Hosting | 선택(설정만 있고 지금은 올리지 않음) | `npm run deploy:firebase` |

### JCloud

접속 정보는 저장소에 넣지 않고, 명령을 실행하는 터미널(Git Bash 등)에서 환경 변수로 넣습니다.

```sh
export JCLOUD_HOST=<서버 주소>
export JCLOUD_PORT=<SSH 포트>        # 기본 22
export JCLOUD_USER=<SSH 계정>        # 기본 ubuntu
export JCLOUD_KEY=<SSH 키 파일 경로>
export JCLOUD_URL=<웹 접속 주소>     # 배포 후 안내용, 선택
export JCLOUD_KNOWN_HOSTS=<호스트 키 파일>  # 기본 $HOME/.ssh/known_hosts, 선택
```

처음 한 번은 서버를 준비합니다. Nginx 설치, `/var/www/jbnu-term-project` 폴더 생성, `deploy/nginx-jbnu-term-project.conf` 연결을 하며 sudo 비밀번호를 물을 수 있습니다.

```sh
npm run deploy:jcloud:setup
```

서버 방화벽(ufw)은 새로 켜지 않습니다. 바깥에서 들어오는 포트는 JCloud가 연결해 주고, JCloud 서버의 SSH는 22번이 아닌 포트로 열려 있어 22번만 허용하고 켜면 접속이 끊기기 때문입니다.

그다음부터는 빌드와 업로드를 한 번에 합니다.

```sh
npm run deploy:jcloud
```

Nginx 설정은 화면 주소로 바로 들어오거나 새로고침해도 앱이 열리도록 모든 경로를 `index.html`로 보냅니다.

### Firebase Hosting

처음 한 번 Firebase CLI에 로그인합니다. 배포 대상 프로젝트는 `.firebaserc`에 `jbnu-term-project`로 정해 두었습니다.

```sh
npx firebase-tools login
npm run deploy:firebase
```

배포 주소는 `https://jbnu-term-project.web.app`입니다.

## 코드 구조와 디자인 패턴

화면(컴포넌트), 처리 규칙(순수 함수), 데이터 접근(Repository·통신 창구)을 나눴습니다. 아래 9가지 패턴은 실제로 동작하는 코드에 들어 있고, `src/battle/patterns.test.js` 등에서 협력 관계를 시험합니다.

| 패턴 | 위치 | 참여 요소와 협력 | 해결한 문제 |
|---|---|---|---|
| Strategy | `capture/parsers.js` `STRATEGIES`, `battle/bot.js` `kiter`·`rusher`, `battle/topView.js`·`firstPerson/FirstPersonView.js`, `battle/modes/index.js` `MODES` | 캡처 화면별 읽기 규칙 8개({ id, match, parse })를 `readCapture`가 골라 씀. 대결은 사람 입력(`InputController`)과 봇 성격이 같은 `commands(world, me)`를 갖고, `PracticeLoop`가 플레이어마다 전략을 들고 부름. 시점은 `TopView`·`FirstPersonView`가 같은 `draw(ctx, world, me, info)`를 갖고 `Renderer`가 바꿔 끼움. 모드 12가지는 등록부의 객체로, 규칙(`enter`·`step`·`leave`)은 세계가, 그림(`draw`)은 렌더러가 지금 모드의 것만 부름 | 화면마다 다른 읽는 법, 사람·봇 입력을 같은 자리에 꽂기, 판 도중 시점·규칙을 분기 없이 바꾸기 |
| Adapter | `battle/channel.js` | Target `RoomChannel`, Adaptee Firebase RTDB 래퍼(`net.js`), Adapter `FirebaseRoomChannel`, 같은 인터페이스의 `MemoryRoom`, Client `OnlineLoop`·`linkWorld` | 대결 루프를 Firebase에서 떼어 두 화면 동기화를 자동 테스트 |
| Template Method | `battle/loop.js` | `MatchLoop`가 프레임 뼈대를 정하고 `PracticeLoop`·`OnlineLoop`가 `countdown`·`collectCommands`·`afterStep`·`finish`만 바꿈 | 연습·온라인의 같은 순서, 다른 입력·동기화 |
| State | `battle/phases.js` | Context `MatchLoop`, 상태 `Countdown`·`Playing`·`Settling`(온라인의 마지막 상태 주고받기)·`Over`가 이번 프레임 할 일과 다음 상태를 정함 | 루프 곳곳의 단계 if·플래그 |
| Command | `battle/input.js`, `battle/world.js` `COMMANDS` | 입력 → 명령 객체 { type, ... } → `executeCommands`가 실행 | 입력 장치와 게임 규칙 분리, 봇·사람·테스트가 같은 명령 |
| Factory Method | `battle/skills.js` | 기술마다 `cast`가 제품 `Swing`(근접 휘두르기, `melee.js`)·`Lunge`·`Teleport`·`Leap`·`Block`·`Projectile`·`Trap`·`Turret`·`Shockwave`·`SelfEffect`를 만들고, `world.spawnEvent`는 `part.place(world)`만 부름 | 기술이 늘어도 세계 코드에 분기가 늘지 않음 |
| Object Pool | `battle/pool.js` | `Pool.acquire`·`sweep`으로 발사체·도트 파편 객체를 다시 씀 | 초당 60번 도는 루프의 객체 생성 줄이기 |
| Observer | `lib/subject.js`, `world.signals` | Subject가 피격·아웃·아이템·폭풍 경고·카운트다운 신호를 알리고, 렌더러(`Renderer.react`)와 효과음(`soundBoard`)이 각자 구독·해지 | 그리기와 소리를 떼고, 반응하는 쪽을 늘려도 world는 그대로 |
| Repository | `data/repositories.js` | 인터페이스(기록·프로필·전적), Firestore 구현(`firestoreRepositories.js`), 메모리 구현(`memoryRepositories.js`), 화면은 `useRepositories()`로 받은 것만 씀 | 화면을 Firebase 없이 시험, 서비스 규칙(`planSave` 등)을 두 구현이 함께 씀 |

## 테스트

`npm test`로 51개 파일, 571개 테스트를 돌립니다(봇 균형 실험 `balance.test.js`는 `BALANCE=1`일 때만 돈다)(GitHub Actions도 같은 명령).

| 영역 | 파일 | 무엇을 확인하나 |
|---|---|---|
| 기록·서비스 규칙 | `records/*.test.js` | 날짜 창(오늘·어제, 7일), 값 범위, 문서 변환, 오류 문구, 자정 계산, 캡처 읽기 재시도 |
| 캡처 읽기 | `capture/capture.test.js` | 화면별 읽기 규칙, 실제 캡처 글자에서 값 뽑기 |
| 지표·건강 | `stats/metrics.test.js` | 디지털 건강 계산, 모르는 항목 처리 |
| 캐릭터 | `character/*.test.js(x)` | 같은 사용 = 같은 그림, 앱 조각, 상태 표시, 잠금 화면 알림 |
| 대결 | `battle/battle.test.js`, `skills.test.js`, `attacks.test.js`, `bot.test.js`, `latency.test.js`, `robust.test.js` | 대결 능력, 기술 제품, 공격 움직임, 봇 전략, 판 중간 사건, 지연 보정, 끊김·늦음·무승부 |
| 모드 | `battle/modes/*.test.js` | 12가지 모드의 들어감·나옴, 넘기기 파도, 광고 건너뛰기, 박자, 업데이트, 보스, 좌표 변환, 그리기 |
| 자동 실험 | `battle/simulation.test.js` | 봇 연습 160판에서 이상 상태 없음, 지연을 흉내 낸 온라인 30판에서 모든 화면의 순위가 같음 |
| 연출 | `battle/motions.test.js`, `dive.test.js`, `firstPerson/*.test.js`, `audio/audio.test.js`, `ui/appRain.test.jsx`, `lib/motion.test.js` | 자세·관절, 1인칭 전환 시각과 조작, 광선 계산, 효과음 표, 앱 비, 움직임 설정 |
| 패턴 협력 | `battle/patterns.test.js`, `data/repositories.test.jsx` | State·Observer·Adapter·Repository의 참여 요소가 함께 동작하는지(메모리 방·메모리 저장소로) |
| 화면·예외 | `ui/*.test.jsx`, `data/repositories.test.jsx` | 결과 화면 저장 실패 경고, 불러오기 실패·다시 불러오기, 빈 목록 |
| 보안 규칙 | `rules/firestore.rules.test.js`, `rules/database.rules.test.js` | 에뮬레이터에서 비로그인·본인·다른 계정으로 읽고 쓰기: 프로필·하루 기록(날짜 창, 값 범위, 칸 제한)·전적(고치기·지우기 불가), 대결 방(방 코드, 자리, 방장·상태 순서, 남의 상태·이벤트, 체력·목숨) |

보안 규칙은 `npm run test:rules`로 확인합니다. Firebase 에뮬레이터(Firestore·Realtime Database)에 `firestore.rules`, `database.rules.json`을 올리고, 앱이 실제로 보내는 모양의 값으로 허용돼야 할 요청은 성공, 막혀야 할 요청은 거절되는지 57개 테스트로 확인합니다. 에뮬레이터는 Java 21이 필요하고, `demo-jbnu` 프로젝트라 로그인 없이 돕니다. GitHub Actions의 `rules` 작업이 PR마다 같은 명령을 돌립니다.

## 개발 방식

- 작업은 Issue로 먼저 등록하고, `feature/<이슈번호>-<작업명>` 브랜치에서 진행합니다.
- Pull Request에서 GitHub Actions 검사가 통과하면 `main`에 병합합니다.
- 비밀번호, API 키 같은 민감한 값은 저장소에 올리지 않고 `.env.local`에만 둡니다.
