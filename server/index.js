import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || (process.env.RENDER ? "0.0.0.0" : "127.0.0.1");
const serverDir = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(serverDir, "../dist");
const indexHtmlPath = resolve(distDir, "index.html");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};
const allowedGenders = new Set(["여자", "남자", "중성", "선택안함"]);
const allowedStyles = new Set(["세련된", "부르기 쉬운", "아름다운", "유니크한", "선택안함"]);

const defaultResult = {
  primaryName: {
    name: "",
    hangulPronunciation: "",
    tagline: ""
  },
  alternatives: [],
  analysis: {
    sajuSummary: "",
    nameologySummary: "",
    practicalReason: ""
  },
  usageTips: [],
  disclaimer: ""
};

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function extractJson(text) {
  if (!text) return null;

  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    // Fall through to brace extraction.
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    return null;
  }

  try {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  } catch (error) {
    return null;
  }
}

function normalizeResult(data) {
  if (!data || typeof data !== "object") {
    return defaultResult;
  }

  const primary = data.primaryName || {};
  const analysis = data.analysis || {};
  const alternatives = Array.isArray(data.alternatives) ? data.alternatives : [];
  const usageTips = Array.isArray(data.usageTips) ? data.usageTips : [];

  return {
    primaryName: {
      name: String(primary.name || ""),
      hangulPronunciation: String(primary.hangulPronunciation || ""),
      tagline: String(primary.tagline || "")
    },
    alternatives: alternatives
      .map((item) => ({
        name: String(item?.name || ""),
        hangulPronunciation: String(item?.hangulPronunciation || ""),
        reason: String(item?.reason || "")
      }))
      .filter((item) => item.name),
    analysis: {
      sajuSummary: String(analysis.sajuSummary || ""),
      nameologySummary: String(analysis.nameologySummary || ""),
      practicalReason: String(analysis.practicalReason || "")
    },
    usageTips: usageTips.map((tip) => String(tip)).filter(Boolean),
    disclaimer: String(data.disclaimer || "")
  };
}

function buildMessages({ koreanName, birthDate, birthTime, gender, style }) {
  const systemMessage = [
    "당신은 한국인 사용자의 영어 이름을 제안하는 전문 작명 어시스턴트입니다.",
    "입력된 한글 이름, 생년월일, 태어난 시간을 바탕으로 사주 해석과 성명학적 느낌을 '참고 관점'으로 활용해 제안하세요.",
    "성별 정보는 참고용이며 고정관념은 피하세요. 성별이 '중성' 또는 '선택안함'이면 중립적이고 범용적인 이름을 우선 제안하세요.",
    "사용자가 스타일 선호를 고르면 해당 톤을 이름/설명에 반영하세요. 스타일이 '선택안함'이면 균형 잡힌 기본 추천을 하세요.",
    "절대 단정적 운세 표현은 피하고, 부르기 쉬움/발음/실사용성 중심으로 설명하세요.",
    "반드시 유효한 JSON 객체만 출력하세요."
  ].join(" ");

  const userMessage = [
    "다음 사용자에게 영어 이름을 추천해 주세요.",
    `- 한글 이름: ${koreanName}`,
    `- 생년월일: ${birthDate}`,
    `- 태어난 시간: ${birthTime}`,
    `- 성별: ${gender}`,
    `- 스타일: ${style}`,
    "",
    "반환 JSON 스키마:",
    "{",
    '  "primaryName": {',
    '    "name": "가장 추천하는 영어 이름",',
    '    "hangulPronunciation": "한글 발음",',
    '    "tagline": "한 줄 추천 이유"',
    "  },",
    '  "alternatives": [',
    "    {",
    '      "name": "대안 이름",',
    '      "hangulPronunciation": "한글 발음",',
    '      "reason": "짧은 이유"',
    "    }",
    "  ],",
    '  "analysis": {',
    '    "sajuSummary": "사주 관점 요약(2~3문장)",',
    '    "nameologySummary": "성명학 관점 요약(2~3문장)",',
    '    "practicalReason": "현실적으로 부르기 쉬운 이유"',
    "  },",
    '  "usageTips": ["해외에서 소개할 때 팁", "닉네임/스펠링 팁"],',
    '  "disclaimer": "운세/작명은 참고용이라는 안내"',
    "}",
    "조건:",
    "- primaryName은 1개",
    "- alternatives는 2~3개",
    "- 이름은 실제 영어권에서 낯설지 않은 형태",
    "- 한국인이 발음하기 어렵지 않을 것"
  ].join("\n");

  return {
    systemMessage,
    userMessage
  };
}

async function requestEnglishName(payload) {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  const model = (process.env.OPENAI_MODEL || "gpt-4o-mini").trim();

  if (!apiKey) {
    throw new HttpError(500, "OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  const { systemMessage, userMessage } = buildMessages(payload);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
      ]
    })
  });

  if (!response.ok) {
    let message = `OpenAI API 호출 실패 (${response.status})`;
    try {
      const errorData = await response.json();
      const detail = errorData?.error?.message;
      if (detail) message = detail;
    } catch (error) {
      // Ignore error response parse issues.
    }
    throw new HttpError(response.status, message);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  const parsed = extractJson(content);

  if (!parsed) {
    throw new HttpError(502, "OpenAI 응답을 JSON으로 해석하지 못했습니다.");
  }

  return normalizeResult(parsed);
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();

  if (!raw) {
    throw new HttpError(400, "요청 본문이 비어 있습니다.");
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new HttpError(400, "JSON 본문 형식이 올바르지 않습니다.");
  }
}

function sendText(res, statusCode, text) {
  const body = String(text);
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function isFile(path) {
  try {
    const fileStat = await stat(path);
    return fileStat.isFile();
  } catch (error) {
    return false;
  }
}

function getContentType(filePath) {
  return contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function sendFile(res, method, filePath) {
  const body = await readFile(filePath);
  res.writeHead(200, {
    "Cache-Control": extname(filePath) === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": getContentType(filePath)
  });

  if (method === "HEAD") {
    res.end();
    return;
  }

  res.end(body);
}

async function serveFrontend(pathname, method, res) {
  if (pathname.startsWith("/api/")) {
    return false;
  }

  const requestedPath = resolve(distDir, `.${pathname}`);
  if (!requestedPath.startsWith(distDir)) {
    return false;
  }

  if (await isFile(requestedPath)) {
    await sendFile(res, method, requestedPath);
    return true;
  }

  if (extname(pathname)) {
    return false;
  }

  if (!(await isFile(indexHtmlPath))) {
    sendText(res, 503, "Frontend build output not found. Run `npm run build` first.");
    return true;
  }

  await sendFile(res, method, indexHtmlPath);
  return true;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/recommend-name") {
    try {
      const body = await readJsonBody(req);
      const koreanName = String(body?.koreanName || "").trim();
      const birthDate = String(body?.birthDate || "").trim();
      const birthTime = String(body?.birthTime || "").trim();
      const inputGender = String(body?.gender || "").trim();
      const gender = allowedGenders.has(inputGender) ? inputGender : "선택안함";
      const inputStyle = String(body?.style || "").trim();
      const style = allowedStyles.has(inputStyle) ? inputStyle : "선택안함";

      if (!koreanName || !birthDate || !birthTime) {
        sendJson(res, 400, { message: "koreanName, birthDate, birthTime을 모두 입력해 주세요." });
        return;
      }

      const result = await requestEnglishName({ koreanName, birthDate, birthTime, gender, style });
      sendJson(res, 200, result);
    } catch (error) {
      const statusCode = error?.statusCode || 500;
      const message = error instanceof Error ? error.message : "서버 처리 중 오류가 발생했습니다.";
      sendJson(res, statusCode, { message });
    }
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    try {
      const served = await serveFrontend(url.pathname, req.method, res);
      if (served) return;
    } catch (error) {
      sendText(res, 500, "Failed to serve frontend files.");
      return;
    }
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(res, 404, { message: "Not Found" });
    return;
  }

  sendText(res, 404, "Not Found");
});

server.listen(port, host, () => {
  console.log(`[server] listening on http://${host}:${port}`);
});
