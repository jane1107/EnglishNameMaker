# AI 영어 이름 작명 서비스

한글 이름, 생년월일, 태어난 시간을 입력하면 OpenAI API를 호출해
사주/성명학 참고 해석 + 실사용성을 기반으로 영어 이름을 추천하는 React 웹 앱입니다.

## 1) 설치 및 실행

```bash
npm install
cp .env.example .env
npm run start
```

브라우저에서 `http://localhost:5173` 접속 (포트가 이미 사용 중이면 다른 포트로 자동 변경)

## 2) 환경 변수

- `OPENAI_API_KEY`: OpenAI API 키 (서버에서만 사용)
- `OPENAI_MODEL`: 사용 모델 (기본값 `gpt-4o-mini`)
- `PORT`: 백엔드 서버 포트 (기본값 `3001`)

## 3) 동작 방식

1. 사용자가 이름/성별/스타일/생년월일/태어난 시간을 입력
2. 프론트엔드는 `/api/recommend-name` 엔드포인트를 호출
3. Node 서버가 OpenAI Chat Completions API를 호출
4. 서버가 JSON 응답을 정리해 프론트엔드로 반환

## 4) 주의 사항

- API 키는 서버 환경변수로만 관리됩니다.
