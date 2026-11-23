# 마케팅 메이트 (Marketing Mate)

AI를 활용하여 상품이나 지역 축제의 효과적인 홍보 문구, SNS 콘텐츠, 타깃 고객 분석, 마케팅 전략을 제안해 주는 웹 서비스입니다.

## 주요 기능

1. **AI 홍보 문구 생성**: 짧고 강렬한 문구, 감성적인 문구, 재미있는 문구, SNS 게시물용 문구를 한 번에 생성하고 복사할 수 있습니다.
2. **SNS 콘텐츠 추천**: 인스타그램 게시물, 인스타그램 릴스, 틱톡 영상 아이디어와 해시태그를 추천합니다.
3. **타깃 고객 분석**: 예상 연령대, 고객 관심사, 선정 이유, 효과적인 홍보 방법을 분석해 제공합니다. *(AI 예상 참고 분석 안내 포함)*
4. **AI 마케팅 전략 추천**: 온라인·오프라인 홍보 방법, 이벤트 아이디어, 홍보 효과를 높이는 방법을 쉽게 설명합니다.
5. **최근 생성 결과 확인**: 브라우저 `localStorage`에 최근 결과를 자동 저장해 다시 열어보거나 복사할 수 있습니다.

## 기술 스택

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React
- **Backend**: Node.js, Express (`server.ts`)
- **AI**: Google Gemini API (`@google/genai`)

## 로컬 실행 방법

1. 패키지 설치
   ```bash
   npm install
   ```

2. 환경 변수 설정  
   `.env.example` 파일을 복사해 `.env` 파일을 만들고 `GEMINI_API_KEY`를 입력합니다.
   ```bash
   cp .env.example .env
   ```

3. 개발 서버 실행
   ```bash
   npm run dev
   ```
   브라우저에서 `http://localhost:3000`으로 접속합니다.

4. 프로덕션 빌드 및 실행
   ```bash
   npm run build
   npm start
   ```

## 관련 문서

- 제품 요구사항 정의서: `PRD.md`
