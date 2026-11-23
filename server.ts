import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

type FeatureType = 'copywriting' | 'sns' | 'target' | 'strategy';

interface GenerateRequestBody {
  featureType?: FeatureType;
  subject?: string;
  features?: string;
  goal?: string;
  extraContext?: string;
  variationSeed?: number;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getSchemaAndInstruction(featureType: FeatureType) {
  switch (featureType) {
    case 'copywriting':
      return {
        systemInstruction:
          '당신은 고등학생과 소상공인도 쉽게 활용할 수 있도록 돕는 친근하고 유능한 한국어 마케팅 카피라이터입니다. 입력된 상품이나 지역 축제의 특징과 목적을 정확히 반영하여, 4가지 스타일(짧고 강렬한 문구, 감성적인 문구, 재미있는 문구, SNS 게시물용 문구)의 홍보 문구를 한국어로 작성하세요. 각 항목은 바로 복사해서 쓸 수 있게 완성도 높게 작성하세요.',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shortPunchy: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING, description: '짧고 강렬한 한 줄 헤드라인' },
                body: { type: Type.STRING, description: '임팩트 있는 짧은 본문 문구 (1~2문장)' },
                tip: { type: Type.STRING, description: '어디에 쓰면 좋은지 간단한 활용 팁' },
              },
              required: ['headline', 'body', 'tip'],
            },
            emotional: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING, description: '따뜻하고 감성적인 제목' },
                body: { type: Type.STRING, description: '공감과 여운을 주는 감성 홍보 문구 (2~3문장)' },
                tip: { type: Type.STRING, description: '감성 문구 활용 팁' },
              },
              required: ['headline', 'body', 'tip'],
            },
            fun: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING, description: '재치 있고 유쾌한 제목' },
                body: { type: Type.STRING, description: '웃음이나 호기심을 유발하는 재미있는 문구 (2~3문장)' },
                tip: { type: Type.STRING, description: '재미있는 문구 활용 팁' },
              },
              required: ['headline', 'body', 'tip'],
            },
            snsPost: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING, description: 'SNS 피드 첫 줄 시선 집중 문구' },
                body: { type: Type.STRING, description: '인스타그램/페이스북 게시물에 바로 올릴 수 있는 본문 및 참여 유도 문장' },
                tip: { type: Type.STRING, description: 'SNS 업로드 시 추천하는 팁' },
              },
              required: ['headline', 'body', 'tip'],
            },
          },
          required: ['shortPunchy', 'emotional', 'fun', 'snsPost'],
        },
      };

    case 'sns':
      return {
        systemInstruction:
          '당신은 10대~30대 트렌드에 밝은 한국어 SNS 콘텐츠 기획자입니다. 상품이나 지역 축제 정보를 바탕으로 실제로 학생이나 소상공인이 스마트폰으로 바로 촬영하고 업로드할 수 있는 구체적인 인스타그램 게시물, 인스타그램 릴스, 틱톡 영상 아이디어와 해시태그를 추천하세요.',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            instagramPosts: {
              type: Type.ARRAY,
              description: '인스타그램 카드뉴스/사진 게시물 아이디어 2가지',
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: '게시물 아이디어 제목' },
                  concept: { type: Type.STRING, description: '카드뉴스 또는 사진 구성 설명' },
                  visualTip: { type: Type.STRING, description: '사진 촬영 또는 디자인 팁' },
                  captionExample: { type: Type.STRING, description: '게시물에 함께 올릴 캡션 예시' },
                },
                required: ['title', 'concept', 'visualTip', 'captionExample'],
              },
            },
            instagramReels: {
              type: Type.ARRAY,
              description: '인스타그램 릴스(숏폼) 아이디어 2가지',
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: '릴스 아이디어 제목' },
                  hook: { type: Type.STRING, description: '처음 3초 안에 시선을 끄는 도입부 장면/멘트' },
                  flow: { type: Type.STRING, description: '전체 영상 흐름 요약 (15~30초 기준)' },
                  musicMood: { type: Type.STRING, description: '어울리는 배경음악 분위기' },
                },
                required: ['title', 'hook', 'flow', 'musicMood'],
              },
            },
            tiktokVideos: {
              type: Type.ARRAY,
              description: '틱톡 영상 아이디어 2가지',
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: '틱톡 영상 아이디어 제목' },
                  hook: { type: Type.STRING, description: '첫 장면 시선 끌기 포인트' },
                  scriptIdea: { type: Type.STRING, description: '짧고 리듬감 있는 영상 구성 및 대사 아이디어' },
                  challengePoint: { type: Type.STRING, description: '시청자 댓글/공유를 유도하는 참여 포인트' },
                },
                required: ['title', 'hook', 'scriptIdea', 'challengePoint'],
              },
            },
            hashtags: {
              type: Type.ARRAY,
              description: '#으로 시작하는 추천 해시태그 10개',
              items: { type: Type.STRING },
            },
          },
          required: ['instagramPosts', 'instagramReels', 'tiktokVideos', 'hashtags'],
        },
      };

    case 'target':
      return {
        systemInstruction:
          '당신은 상품과 축제의 주요 고객층을 알기 쉽게 분석해 주는 마케팅 분석가입니다. 실제 통계 데이터가 아니라 입력된 특징과 목적을 바탕으로 AI가 추론한 예상 분석이라는 점을 명확히 밝히고, 가장 적합한 핵심 타깃 고객층 2~3그룹을 선정해 예상 연령대, 관심사, 선정 이유, 효과적인 홍보 방법을 고등학생도 이해하기 쉬운 한국어로 설명하세요.',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            disclaimer: {
              type: Type.STRING,
              description: '실제 통계 조사가 아닌 입력 정보를 바탕으로 한 AI의 예상 분석이라는 안내 문구',
            },
            primaryTargets: {
              type: Type.ARRAY,
              description: '추천 주요 타깃 고객층 2~3개',
              items: {
                type: Type.OBJECT,
                properties: {
                  segmentName: { type: Type.STRING, description: '고객층 이름 (예: 트렌드에 민감한 10~20대 학생층)' },
                  ageRange: { type: Type.STRING, description: '예상 연령대 (예: 만 16세 ~ 24세)' },
                  interests: {
                    type: Type.ARRAY,
                    description: '주요 관심사 키워드 3~4개',
                    items: { type: Type.STRING },
                  },
                  selectionReason: { type: Type.STRING, description: '이 고객층을 주요 타깃으로 선정한 이유' },
                  effectiveMethods: {
                    type: Type.ARRAY,
                    description: '이 고객층에게 효과적인 홍보 방법 2~3가지',
                    items: { type: Type.STRING },
                  },
                },
                required: ['segmentName', 'ageRange', 'interests', 'selectionReason', 'effectiveMethods'],
              },
            },
            summaryAdvice: {
              type: Type.STRING,
              description: '추천 고객층을 공략할 때 가장 중요한 한 줄 핵심 조언',
            },
          },
          required: ['disclaimer', 'primaryTargets', 'summaryAdvice'],
        },
      };

    case 'strategy':
      return {
        systemInstruction:
          '당신은 고등학생과 소상공인에게 실질적인 도움을 주는 친절한 마케팅 전략 코치입니다. 어려운 마케팅 전문 용어는 쉬운 말로 풀어서 설명하며, 바로 실행할 수 있는 온라인 홍보 방법, 오프라인 홍보 방법, 이벤트 아이디어, 홍보 효과를 높이는 방법을 구체적으로 제안하세요.',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            onlineStrategies: {
              type: Type.ARRAY,
              description: '온라인 홍보 방법 3가지',
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: '전략 이름' },
                  description: { type: Type.STRING, description: '고등학생도 쉽게 이해할 수 있는 전략 설명' },
                  actionStep: { type: Type.STRING, description: '오늘 당장 해볼 수 있는 구체적인 실행 단계' },
                },
                required: ['title', 'description', 'actionStep'],
              },
            },
            offlineStrategies: {
              type: Type.ARRAY,
              description: '오프라인 홍보 방법 3가지',
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: '전략 이름' },
                  description: { type: Type.STRING, description: '현장이나 주변에서 실행하기 쉬운 설명' },
                  actionStep: { type: Type.STRING, description: '실행 준비물 또는 행동 요령' },
                },
                required: ['title', 'description', 'actionStep'],
              },
            },
            eventIdeas: {
              type: Type.ARRAY,
              description: '참여를 이끄는 이벤트 아이디어 2가지',
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: '이벤트 이름' },
                  description: { type: Type.STRING, description: '이벤트 진행 방법 설명' },
                  expectedEffect: { type: Type.STRING, description: '이 이벤트로 기대할 수 있는 효과' },
                },
                required: ['title', 'description', 'expectedEffect'],
              },
            },
            boostingTips: {
              type: Type.ARRAY,
              description: '홍보 효과를 더 높이는 핵심 팁 3가지',
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: '핵심 팁 제목' },
                  description: { type: Type.STRING, description: '알기 쉬운 구체적 실천 팁' },
                },
                required: ['title', 'description'],
              },
            },
          },
          required: ['onlineStrategies', 'offlineStrategies', 'eventIdeas', 'boostingTips'],
        },
      };
  }
}

function logDebug(line: string) {
  const entry = `${new Date().toISOString()} ${line}\n`;
  console.log(entry.trim());
  try {
    fs.appendFileSync('/tmp/mm_debug.log', entry);
  } catch {
    // ignore
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`TIMEOUT_${label}_${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function generateWithRetry(
  ai: GoogleGenAI,
  featureType: FeatureType,
  userPrompt: string
): Promise<string> {
  const { systemInstruction, responseSchema } = getSchemaAndInstruction(featureType);

  let lastError: unknown;
  const modelsToTry: Array<{ model: string; thinkingLevel?: ThinkingLevel }> = [
    { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
    { model: MODEL_NAME, thinkingLevel: ThinkingLevel.LOW },
  ];

  for (const candidate of modelsToTry) {
    const t0 = Date.now();
    logDebug(`[START] model=${candidate.model} feature=${featureType}`);
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: candidate.model,
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema,
            ...(candidate.thinkingLevel
              ? { thinkingConfig: { thinkingLevel: candidate.thinkingLevel } }
              : {}),
          },
        }),
        18000,
        candidate.model
      );
      const text = response.text?.trim();
      logDebug(`[OK] model=${candidate.model} feature=${featureType} ms=${Date.now() - t0}`);
      if (!text) {
        throw new Error('EMPTY_RESPONSE');
      }
      return text;
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      logDebug(`[ERR] model=${candidate.model} ms=${Date.now() - t0} err=${msg}`);
      if (msg.includes('400') || msg.includes('403') || msg.includes('API_KEY_INVALID')) {
        throw error;
      }
    }
  }
  throw lastError;
}

function mapGeminiError(error: unknown): { status: number; message: string; code: string } {
  const rawMessage = error instanceof Error ? error.message : String(error);

  if (rawMessage.includes('API_KEY_INVALID') || rawMessage.includes('PERMISSION_DENIED') || rawMessage.includes('403')) {
    return {
      status: 403,
      code: 'API_AUTH_ERROR',
      message: 'Gemini API 인증에 실패했습니다. Settings > Secrets 패널에서 API 키 상태를 확인해 주세요.',
    };
  }
  if (rawMessage.includes('RESOURCE_EXHAUSTED') || rawMessage.includes('429')) {
    return {
      status: 429,
      code: 'RATE_LIMITED',
      message: '요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.',
    };
  }
  if (rawMessage.includes('NOT_FOUND') || rawMessage.includes('404')) {
    return {
      status: 502,
      code: 'MODEL_NOT_FOUND',
      message: 'AI 모델을 찾을 수 없습니다. 서버 설정을 확인해 주세요.',
    };
  }
  if (rawMessage === 'EMPTY_RESPONSE') {
    return {
      status: 502,
      code: 'EMPTY_RESPONSE',
      message: 'AI로부터 올바른 응답을 받지 못했습니다. 다시 생성해 주세요.',
    };
  }
  return {
    status: 500,
    code: 'GEMINI_REQUEST_FAILED',
    message: 'AI 서버와 연결하는 중 오류가 발생했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    res.json({ ok: true, aiReady: hasKey });
  });

  app.get('/api/download-zip', (_req: Request, res: Response) => {
    const zipPath = path.resolve(__dirname, 'marketing-mate-github.zip');
    if (!fs.existsSync(zipPath)) {
      res.status(404).json({ error: 'ZIP 파일을 찾을 수 없습니다.' });
      return;
    }
    res.download(zipPath, 'marketing-mate-github.zip');
  });

  app.post('/api/marketing/generate', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as GenerateRequestBody;
    const { featureType, subject, features, goal, extraContext, variationSeed } = body;

    if (!featureType || !['copywriting', 'sns', 'target', 'strategy'].includes(featureType)) {
      res.status(400).json({
        error: '올바른 마케팅 기능 유형을 선택해 주세요.',
        code: 'INVALID_FEATURE_TYPE',
      });
      return;
    }

    const cleanSubject = typeof subject === 'string' ? subject.trim() : '';
    const cleanFeatures = typeof features === 'string' ? features.trim() : '';
    const cleanGoal = typeof goal === 'string' ? goal.trim() : '';
    const cleanExtra = typeof extraContext === 'string' ? extraContext.trim() : '';

    if (!cleanSubject || !cleanFeatures || !cleanGoal) {
      res.status(400).json({
        error: '상품/축제 이름, 주요 특징, 홍보 목적을 모두 입력해 주세요.',
        code: 'MISSING_INPUTS',
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'AI API 키가 연결되지 않아 결과를 생성할 수 없습니다. Settings > Secrets 패널에서 GEMINI_API_KEY를 설정해 주세요.',
        code: 'API_NOT_CONFIGURED',
      });
      return;
    }

    const variationNote =
      typeof variationSeed === 'number' && variationSeed > 0
        ? `\n- 요청 회차(${variationSeed + 1}번째 생성): 이전과는 다른 새로운 관점과 신선한 표현으로 다양하게 제안해 주세요.`
        : '';

    const userPrompt = [
      '다음 홍보 대상 정보를 바탕으로 요청된 형식의 마케팅 결과를 생성해 주세요.',
      `- 상품/축제 이름: ${cleanSubject}`,
      `- 주요 특징 및 매력: ${cleanFeatures}`,
      `- 홍보 목적: ${cleanGoal}`,
      cleanExtra ? `- 추가 요청/분위기: ${cleanExtra}` : '',
      variationNote,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const jsonText = await generateWithRetry(ai, featureType, userPrompt);
      const parsed = JSON.parse(jsonText);
      res.json({
        featureType,
        result: parsed,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Gemini API Error]', error);
      const mapped = mapGeminiError(error);
      res.status(mapped.status).json({
        error: mapped.message,
        code: mapped.code,
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Marketing Mate server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
