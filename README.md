# 초급프로젝트 Term Project

2026학년도 2학기 초급프로젝트(일반 분반) Term Project 저장소입니다.
React로 화면을 만들고 Firebase로 로그인과 데이터를 관리하며, 빌드 결과를 JCloud에 배포합니다.

> 서비스 주제와 기능 소개는 주제 확정 후 이 문서에 추가합니다.

## 기술 구성

- React 19 + Vite
- Firebase Authentication, Cloud Firestore (예정)
- Vitest (단위 테스트)
- oxlint (린트)
- GitHub Actions (린트·테스트·빌드 자동 검사)

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
3. 프로젝트 설정 > 내 앱 > 웹 앱의 `firebaseConfig` 값을 확인합니다.
4. `.env.example`을 `.env.local`로 복사하고 값을 채웁니다.

```sh
cp .env.example .env.local
```

`.env.local`이 없으면 화면에 설정 안내가 나타납니다.

## 개발 방식

- 작업은 Issue로 먼저 등록하고, `feature/<이슈번호>-<작업명>` 브랜치에서 진행합니다.
- Pull Request에서 GitHub Actions 검사가 통과하면 `main`에 병합합니다.
- 비밀번호, API 키 같은 민감한 값은 저장소에 올리지 않고 `.env.local`에만 둡니다.
