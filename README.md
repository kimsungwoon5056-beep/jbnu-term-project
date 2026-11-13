# 나를 닮은 몬스터

2026학년도 2학기 초급프로젝트(일반 분반) Term Project 저장소입니다.
수면·운동·공부·식사·기분·나만의 습관을 매일 기록하면, 그 기록이 몬스터의 모습과 능력치가 됩니다.
React로 화면을 만들고 Firebase로 로그인과 데이터를 관리하며, 빌드 결과를 JCloud에 배포합니다.

## 지금 되는 기능

- 이메일/비밀번호 회원가입·로그인·로그아웃
- 하루 기록 등록·조회·수정·삭제 (최근 7일 목록, 30초 입력 화면, "어제와 같음")
- 기록 규칙: 새 기록은 오늘·어제만, 수정·삭제는 7일 이내, 수면 16시간·운동/공부 하루 600분 상한
- 내 몬스터 능력치: 어제까지 최근 7일 기록으로 생활 지표 17개를 계산하고(최근 날일수록 비중 큼), 체력·공격·속도·기술·방어와 성장 단계·전투 스타일을 정합니다. 총합은 꾸준함으로만 정해지고 생활은 배분만 바꿉니다(`src/stats/`).
- 몬스터 외형: 계정마다 고정된 타고난 유전자(몸통 8종·색·눈 6종·귀 4종)와 생활 유전자(몸집·다리·팔·꼬리·눈꺼풀·동공·다크서클·과목별 뿔·배·입꼬리·등 문양·오라·이끼 등)를 48×48 도트 스프라이트로 그리고, 자동 학명을 붙입니다(`src/monster/`). 같은 계정·같은 기록이면 항상 같은 몬스터가 나옵니다.
- 화면: 밤 하늘 RPG 스타일의 도트 게임 화면(RPG 창, 도트 버튼, HP 바 능력치, 기분 도트 아이콘)
- 개발 서버에서 `http://localhost:5173/?gallery`를 열면 시연 인물·성장 단계·무작위 계정의 몬스터 견본을 한 번에 볼 수 있습니다(배포 빌드에는 포함되지 않음).

## 기술 구성

- React 19 + Vite
- Firebase Authentication, Cloud Firestore
- Vitest (단위 테스트)
- oxlint (린트)
- GitHub Actions (린트·테스트·빌드 자동 검사)
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
3. 프로젝트 설정 > 내 앱 > 웹 앱의 `firebaseConfig` 값을 확인합니다.
4. `.env.example`을 `.env.local`로 복사하고 값을 채웁니다.

```sh
cp .env.example .env.local
```

`.env.local`이 없으면 화면에 설정 안내가 나타납니다.

### 데이터 구조와 Security Rules

| 경로 | 내용 | 접근 |
|---|---|---|
| `users/{uid}/records/{YYYY-MM-DD}` | sleep, workouts[], studies[], meals, mood, customHabits[], updatedAt | 본인만 |

규칙은 `firestore.rules`에 있습니다. 본인 기록만 읽고 쓸 수 있고, 새 기록은 한국 시간 기준 오늘·어제만, 수정·삭제는 7일 이내만 허용하며, 필드 이름과 값 범위를 검사합니다. 규칙에는 반복문이 없어 목록 안 항목별 값과 하루 합계는 앱(`src/records/record.js`)에서 검사합니다.

규칙을 바꾼 뒤에는 Firebase에 올립니다(처음 한 번 `npx firebase-tools login` 필요).

```sh
npm run deploy:rules
```

## 배포

같은 빌드(`dist/`)를 두 곳에 올립니다. 빌드할 때 `.env.local`의 Firebase 설정값이 함께 들어가므로, 배포 전에 `.env.local`이 있어야 합니다.

| 위치 | 용도 | 명령 |
|---|---|---|
| JCloud (Ubuntu + Nginx) | 과제 제출용 주소 | `npm run deploy:jcloud` |
| Firebase Hosting | 상시 접속용 주소 | `npm run deploy:firebase` |

### JCloud

접속 정보는 저장소에 넣지 않고, 명령을 실행하는 터미널(Git Bash 등)에서 환경 변수로 넣습니다.

```sh
export JCLOUD_HOST=<서버 주소>
export JCLOUD_PORT=<SSH 포트>        # 기본 22
export JCLOUD_USER=<SSH 계정>        # 기본 ubuntu
export JCLOUD_KEY=<SSH 키 파일 경로>
export JCLOUD_URL=<웹 접속 주소>     # 배포 후 안내용, 선택
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

## 개발 방식

- 작업은 Issue로 먼저 등록하고, `feature/<이슈번호>-<작업명>` 브랜치에서 진행합니다.
- Pull Request에서 GitHub Actions 검사가 통과하면 `main`에 병합합니다.
- 비밀번호, API 키 같은 민감한 값은 저장소에 올리지 않고 `.env.local`에만 둡니다.
