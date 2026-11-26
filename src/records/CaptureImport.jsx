import { useState } from 'react'
import { formatMinutes } from './recordFormat'
import PixelIcon from '../ui/PixelIcon'

function summaryOf({ phone, steps }) {
  const parts = []
  if (phone?.total) parts.push(`화면 ${formatMinutes(phone.total)}`)
  if (phone?.pickups) parts.push(`깨우기 ${phone.pickups}번`)
  if (phone?.notifications) parts.push(`알림 ${phone.notifications}개`)
  if (steps !== null && steps !== undefined) parts.push(`${steps.toLocaleString('ko-KR')}걸음`)
  return parts.join(' · ')
}

// 스크린 타임·디지털 웰빙·건강 앱 캡처를 골라 글자를 읽고, 읽은 값을 입력 칸에 채운다.
// 사진은 이 기기(브라우저) 안에서만 읽고 저장하거나 보내지 않는다.
function CaptureImport({ onResult, onReading, disabled }) {
  const [state, setState] = useState({ status: 'idle' })

  async function handleFiles(event) {
    const files = [...event.target.files]
    event.target.value = ''
    if (files.length === 0) return
    setState({ status: 'reading', done: 0, total: files.length, progress: 0 })
    onReading?.(true)
    try {
      const [{ readImage }, { mergeReads, readCapture }, { readAll, captureErrorText }] = await Promise.all([import('../capture/ocr'), import('../capture/parsers'), import('../capture/readAll')])
      const onProgress = (done, progress) => setState({ status: 'reading', done, total: files.length, progress })
      // 사진마다 따로 읽는다: 한 장이 실패해도 다른 장에서 읽은 값은 남기고, 못 읽은 사진은 이유와 함께 알린다.
      const { result, failed } = await readAll(files, { readImage, readCapture, mergeReads, onProgress })
      const problem = failed.length ? captureErrorText(failed) : ''
      if (!result) {
        setState({ status: 'error', message: problem })
        return
      }
      if (result.filled.length === 0) {
        setState({ status: 'empty', notes: problem ? [problem, ...result.notes] : result.notes })
        return
      }
      setState({ status: 'done', result: { ...result, notes: problem ? [problem, ...result.notes] : result.notes } })
      onResult(result)
    } catch {
      // 읽기 코드 묶음 자체를 받지 못했다(인터넷)
      setState({ status: 'error', message: '' })
    } finally {
      onReading?.(false)
    }
  }

  const reading = state.status === 'reading'
  return (
    <div className="capture-import">
      <label className={`capture-button ${disabled || reading ? 'disabled' : ''}`}>
        <input type="file" accept="image/*" multiple onChange={handleFiles} disabled={disabled || reading} />
        <PixelIcon name="phone" /> {reading ? '읽는 중…' : '캡처로 불러오기'}
      </label>
      <p className="muted capture-hint">
        스크린 타임(위쪽·최다 사용·화면 깨우기·알림)과 건강 앱 걸음 화면을 여러 장 골라도 돼요. 사진은 이 기기 안에서만 읽고 저장하지 않아요.
      </p>
      <div aria-live="polite">
        {reading && (
          <p className="capture-status">
            글자 읽는 중… {state.done}/{state.total}장 {state.progress > 0 && `(${Math.round(state.progress * 100)}%)`}
          </p>
        )}
        {state.status === 'done' && (
          <div className="capture-status done">
            <p>
              <strong>캡처에서 읽었어요:</strong> {summaryOf(state.result)}
            </p>
            <p className="muted">노란 칸이 캡처에서 읽은 값이에요. 숫자를 확인하고 저장하세요.</p>
            {state.result.notes.map((note) => (
              <p key={note} className="form-error">
                {note}
              </p>
            ))}
          </div>
        )}
        {state.status === 'empty' && (
          <p className="form-error" role="alert">
            {state.notes?.[0] ?? '읽을 수 있는 숫자를 찾지 못했어요. 다른 캡처를 고르거나 직접 입력해 주세요.'}
          </p>
        )}
        {state.status === 'error' && (
          <p className="form-error" role="alert">
            {state.message || '캡처를 읽지 못했어요. 인터넷 연결을 확인하거나 직접 입력해 주세요.'}
          </p>
        )}
      </div>
    </div>
  )
}

export default CaptureImport
