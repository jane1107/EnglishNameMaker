import { useMemo, useState } from "react";

const initialForm = {
  koreanName: "",
  birthDate: "",
  birthTime: "",
  gender: "선택안함",
  style: "선택안함",
};

const genderOptions = ["여자", "남자", "중성", "선택안함"];
const styleOptions = [
  "세련된",
  "부르기 쉬운",
  "아름다운",
  "유니크한",
  "선택안함",
];

const defaultResult = {
  primaryName: {
    name: "",
    hangulPronunciation: "",
    tagline: "",
  },
  alternatives: [],
  analysis: {
    sajuSummary: "",
    nameologySummary: "",
    practicalReason: "",
  },
  usageTips: [],
  disclaimer: "",
};

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function wrapCanvasText(ctx, text, maxWidth) {
  const source = String(text || "").trim();
  if (!source) return [];

  const paragraphs = source
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const lines = [];

  for (const paragraph of paragraphs) {
    let line = "";
    for (const char of Array.from(paragraph)) {
      const testLine = line + char;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line.trim());
        line = char.trimStart();
      } else {
        line = testLine;
      }
    }
    if (line.trim()) lines.push(line.trim());
  }

  return lines;
}

function buildResultImage(result, form) {
  const outerPadding = 44;
  const cardPadding = 54;
  const canvasWidth = 1200;
  const cardWidth = canvasWidth - outerPadding * 2;
  const textWidth = cardWidth - cardPadding * 2;
  const lineHeight = 38;

  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  if (!measureCtx) {
    throw new Error("이미지 생성에 필요한 Canvas를 사용할 수 없습니다.");
  }

  const sections = [
    {
      title: "입력 정보",
      lines: [
        `한글 이름: ${form.koreanName || "-"}`,
        `성별: ${form.gender || "선택안함"}`,
        `스타일: ${form.style || "선택안함"}`,
        `생년월일: ${form.birthDate || "-"}`,
        `태어난 시간: ${form.birthTime || "-"}`,
      ],
    },
    {
      title: "사주 관점 요약",
      lines: [result.analysis.sajuSummary || ""],
    },
    {
      title: "성명학 관점 요약",
      lines: [result.analysis.nameologySummary || ""],
    },
    {
      title: "실사용성",
      lines: [result.analysis.practicalReason || ""],
    },
  ];

  if (result.alternatives.length > 0) {
    sections.push({
      title: "대안 이름",
      lines: result.alternatives.map(
        (item, index) =>
          `${index + 1}. ${item.name} (${item.hangulPronunciation}) - ${item.reason}`,
      ),
    });
  }

  if (result.usageTips.length > 0) {
    sections.push({
      title: "사용 팁",
      lines: result.usageTips.map((tip, index) => `${index + 1}. ${tip}`),
    });
  }

  if (result.disclaimer) {
    sections.push({
      title: "안내",
      lines: [result.disclaimer],
    });
  }

  measureCtx.font =
    '500 30px "Noto Sans KR", "Apple SD Gothic Neo", "Segoe UI", sans-serif';

  const measuredSections = sections.map((section) => ({
    title: section.title,
    lines: section.lines.flatMap((line) =>
      wrapCanvasText(measureCtx, line, textWidth),
    ),
  }));

  let contentHeight = 0;
  for (const section of measuredSections) {
    contentHeight += 44;
    contentHeight += section.lines.length * lineHeight;
    contentHeight += 20;
  }

  const headerHeight = 210;
  const footerHeight = 80;
  const cardHeight = headerHeight + contentHeight + footerHeight;
  const canvasHeight = cardHeight + outerPadding * 2;

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("이미지 생성에 필요한 Canvas를 사용할 수 없습니다.");
  }

  const backgroundGradient = ctx.createLinearGradient(
    0,
    0,
    canvasWidth,
    canvasHeight,
  );
  backgroundGradient.addColorStop(0, "#f8fbff");
  backgroundGradient.addColorStop(0.45, "#eef3ff");
  backgroundGradient.addColorStop(1, "#fff4e9");
  ctx.fillStyle = backgroundGradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = "rgba(65, 115, 225, 0.12)";
  ctx.beginPath();
  ctx.arc(180, 160, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 176, 81, 0.14)";
  ctx.beginPath();
  ctx.arc(canvasWidth - 160, canvasHeight - 180, 140, 0, Math.PI * 2);
  ctx.fill();

  const cardX = outerPadding;
  const cardY = outerPadding;
  ctx.save();
  ctx.shadowColor = "rgba(23, 33, 70, 0.16)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 30);
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.fill();
  ctx.restore();

  let y = cardY + cardPadding;
  const x = cardX + cardPadding;

  ctx.fillStyle = "#5c6f98";
  ctx.font =
    '600 24px "Noto Sans KR", "Apple SD Gothic Neo", "Segoe UI", sans-serif';
  ctx.fillText("AI Naming Studio", x, y);

  y += 60;
  ctx.fillStyle = "#15274e";
  ctx.font =
    '700 58px "Noto Sans KR", "Apple SD Gothic Neo", "Segoe UI", sans-serif';
  ctx.fillText(result.primaryName.name || "영어 이름 추천", x, y);

  y += 44;
  if (result.primaryName.hangulPronunciation) {
    ctx.fillStyle = "#2f476f";
    ctx.font =
      '600 30px "Noto Sans KR", "Apple SD Gothic Neo", "Segoe UI", sans-serif';
    ctx.fillText(result.primaryName.hangulPronunciation, x, y);
    y += 40;
  }

  if (result.primaryName.tagline) {
    ctx.fillStyle = "#3f5378";
    ctx.font =
      '500 30px "Noto Sans KR", "Apple SD Gothic Neo", "Segoe UI", sans-serif';
    const taglineLines = wrapCanvasText(
      ctx,
      result.primaryName.tagline,
      textWidth,
    );
    for (const line of taglineLines) {
      ctx.fillText(line, x, y);
      y += lineHeight;
    }
  }

  y += 8;
  ctx.strokeStyle = "#d4deef";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(cardX + cardWidth - cardPadding, y);
  ctx.stroke();

  y += 40;

  for (const section of measuredSections) {
    ctx.fillStyle = "#24355b";
    ctx.font =
      '700 32px "Noto Sans KR", "Apple SD Gothic Neo", "Segoe UI", sans-serif';
    ctx.fillText(section.title, x, y);
    y += 42;

    ctx.fillStyle = "#3f5379";
    ctx.font =
      '500 30px "Noto Sans KR", "Apple SD Gothic Neo", "Segoe UI", sans-serif';
    for (const line of section.lines) {
      ctx.fillText(line, x, y);
      y += lineHeight;
    }
    y += 18;
  }

  const dateLabel = new Date().toLocaleDateString("ko-KR");
  ctx.fillStyle = "#6b7d9c";
  ctx.font =
    '500 22px "Noto Sans KR", "Apple SD Gothic Neo", "Segoe UI", sans-serif';
  ctx.fillText(`생성일: ${dateLabel}`, x, cardY + cardHeight - 24);

  return canvas;
}

function downloadResultImage(result, form) {
  const canvas = buildResultImage(result, form);
  const safeName = (result.primaryName.name || "english-name")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .trim();
  const dateKey = new Date().toISOString().slice(0, 10);
  const fileName = `${safeName || "english-name"}-${dateKey}.png`;

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = fileName;
  link.click();
}

function normalizeResult(data) {
  if (!data || typeof data !== "object") {
    return defaultResult;
  }

  const primary = data.primaryName || {};
  const analysis = data.analysis || {};
  const alternatives = Array.isArray(data.alternatives)
    ? data.alternatives
    : [];
  const usageTips = Array.isArray(data.usageTips) ? data.usageTips : [];

  return {
    primaryName: {
      name: String(primary.name || ""),
      hangulPronunciation: String(primary.hangulPronunciation || ""),
      tagline: String(primary.tagline || ""),
    },
    alternatives: alternatives
      .map((item) => ({
        name: String(item?.name || ""),
        hangulPronunciation: String(item?.hangulPronunciation || ""),
        reason: String(item?.reason || ""),
      }))
      .filter((item) => item.name),
    analysis: {
      sajuSummary: String(analysis.sajuSummary || ""),
      nameologySummary: String(analysis.nameologySummary || ""),
      practicalReason: String(analysis.practicalReason || ""),
    },
    usageTips: usageTips.map((tip) => String(tip)).filter(Boolean),
    disclaimer: String(data.disclaimer || ""),
  };
}

async function requestEnglishName(formData) {
  const response = await fetch("/api/recommend-name", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });

  if (!response.ok) {
    let message = `서버 호출 실패 (${response.status})`;
    try {
      const errorData = await response.json();
      const detail = errorData?.message;
      if (detail) message = detail;
    } catch (error) {
      // Ignore JSON parse errors for error body.
    }
    throw new Error(message);
  }

  const data = await response.json();
  return normalizeResult(data);
}

function ResultCard({ result, onDownload, downloading }) {
  const hasResult = Boolean(result?.primaryName?.name);
  if (!hasResult) return null;

  return (
    <section className="result-card" aria-live="polite">
      <p className="result-label">추천 1순위</p>
      <h2 className="name-main">{result.primaryName.name}</h2>
      <p className="name-pronunciation">
        {result.primaryName.hangulPronunciation}
      </p>
      <p className="name-tagline">{result.primaryName.tagline}</p>

      <div className="analysis-grid">
        <article>
          <h3>사주 관점 요약</h3>
          <p>{result.analysis.sajuSummary}</p>
        </article>
        <article>
          <h3>성명학 관점 요약</h3>
          <p>{result.analysis.nameologySummary}</p>
        </article>
        <article>
          <h3>실사용성</h3>
          <p>{result.analysis.practicalReason}</p>
        </article>
      </div>

      {result.alternatives.length > 0 && (
        <div className="alternatives">
          <h3>대안 이름</h3>
          {result.alternatives.map((item) => (
            <article
              className="alternative-item"
              key={`${item.name}-${item.hangulPronunciation}`}
            >
              <p className="alt-name">
                {item.name} <span>({item.hangulPronunciation})</span>
              </p>
              <p>{item.reason}</p>
            </article>
          ))}
        </div>
      )}

      {result.usageTips.length > 0 && (
        <div className="tips">
          <h3>사용 팁</h3>
          <ul>
            {result.usageTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {result.disclaimer && <p className="disclaimer">{result.disclaimer}</p>}

      <div className="result-actions">
        <button
          type="button"
          className="download-button"
          onClick={onDownload}
          disabled={downloading}
        >
          {downloading ? "이미지 생성 중..." : "결과 이미지 다운로드"}
        </button>
      </div>
    </section>
  );
}

function App() {
  const [form, setForm] = useState(initialForm);
  const [submittedForm, setSubmittedForm] = useState(initialForm);
  const [result, setResult] = useState(defaultResult);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    return Boolean(
      form.koreanName && form.birthDate && form.birthTime && !loading,
    );
  }, [form, loading]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(defaultResult);

    if (!form.koreanName || !form.birthDate || !form.birthTime) {
      setError("모든 입력값을 채워주세요.");
      return;
    }

    setLoading(true);
    try {
      const payload = { ...form };
      const data = await requestEnglishName(payload);
      setResult(data);
      setSubmittedForm(payload);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "이름 생성 중 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result.primaryName.name) return;

    setError("");
    setDownloading(true);
    try {
      downloadResultImage(result, submittedForm);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "이미지 다운로드 중 오류가 발생했습니다.",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="page">
      <div className="ambient-shape shape-one" />
      <div className="ambient-shape shape-two" />

      <section className="panel">
        <header className="header">
          <p className="eyebrow">AI Naming Studio</p>
          <h1>사주 + 성명학 영어 이름 추천</h1>
          <p>
            한글 이름과 생년월일, 태어난 시간을 입력하면 OpenAI가 참고 분석을
            바탕으로 부르기 쉬운 영어 이름을 제안합니다.
          </p>
        </header>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            한글 이름
            <input
              name="koreanName"
              type="text"
              placeholder="예: 김하늘"
              value={form.koreanName}
              onChange={handleChange}
            />
          </label>

          <label>
            생년월일
            <input
              name="birthDate"
              type="date"
              value={form.birthDate}
              onChange={handleChange}
            />
          </label>

          <label>
            태어난 시간
            <input
              name="birthTime"
              type="time"
              value={form.birthTime}
              onChange={handleChange}
            />
          </label>

          <label>
            성별
            <select name="gender" value={form.gender} onChange={handleChange}>
              {genderOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            스타일
            <select name="style" value={form.style} onChange={handleChange}>
              {styleOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" disabled={!canSubmit}>
            {loading ? "이름 생성 중..." : "영어 이름 추천받기"}
          </button>
        </form>

        {error && <p className="error">{error}</p>}
        {!error && !result.primaryName.name && !loading && (
          <p className="empty">
            입력 후 버튼을 누르면 추천 결과가 여기에 표시됩니다.
          </p>
        )}

        <ResultCard
          result={result}
          onDownload={handleDownload}
          downloading={downloading}
        />
      </section>
    </main>
  );
}

export default App;
