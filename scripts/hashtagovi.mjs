// Hashtag-ovi po temi objave: iz naslova i teksta se prepoznaju kompanije, modeli i teme (Nvidia → #Nvidia)
// i stavljaju se odmah posle #AI, pa tek onda opšti hashtag-ovi formata. YouTube prikazuje prva tri iznad naslova.
// Rečnik je namerno ručni: bez AI poziva, uvek isti rezultat i nema izmišljenih ili pogrešnih tagova.

const RECNIK = [
  // Kompanije i proizvodi (pazi na velika slova: "Meta" ne sme da uhvati "metadata")
  [/\bNvidia\b|\bNVIDIA\b/g, '#Nvidia'],
  [/\bOpenAI\b/g, '#OpenAI'],
  [/\bChatGPT\b/g, '#ChatGPT'],
  [/\bSora\b/g, '#Sora'],
  [/\bAnthropic\b/g, '#Anthropic'],
  [/\bClaude Code\b/g, '#ClaudeCode'],
  [/\bClaude\b(?! Code)/g, '#Claude'],
  [/\bGoogle\b/g, '#Google'],
  [/\bGemini\b/g, '#Gemini'],
  [/\bDeepMind\b/g, '#DeepMind'],
  [/\bMeta\b/g, '#Meta'],
  [/\bLlama\b/g, '#Llama'],
  [/\bMicrosoft\b/g, '#Microsoft'],
  [/\bCopilot\b/g, '#Copilot'],
  [/\bGitHub\b/g, '#GitHub'],
  [/\bApple\b/g, '#Apple'],
  [/\bAmazon\b|\bAWS\b/g, '#Amazon'],
  [/\bxAI\b/g, '#xAI'],
  [/\bGrok\b/g, '#Grok'],
  [/\bElon Musk\b|\bMusk\b/g, '#ElonMusk'],
  [/\bDeepSeek\b/g, '#DeepSeek'],
  [/\bQwen\b|\bAlibaba\b/g, '#Qwen'],
  [/\bMistral\b/g, '#MistralAI'],
  [/\bPerplexity\b/g, '#Perplexity'],
  [/\bHugging Face\b/g, '#HuggingFace'],
  [/\bKimi\b|\bMoonshot AI\b/g, '#Kimi'],
  [/\bAMD\b/g, '#AMD'],
  [/\bIntel\b/g, '#Intel'],
  [/\bTSMC\b/g, '#TSMC'],
  [/\bSamsung\b/g, '#Samsung'],
  [/\bTesla\b/g, '#Tesla'],
  [/\bCursor\b/g, '#Cursor'],
  [/\bCloudflare\b/g, '#Cloudflare'],
  [/\bAdobe\b/g, '#Adobe'],
  [/\bMidjourney\b/g, '#Midjourney'],
  [/\bElevenLabs\b/g, '#ElevenLabs'],
  [/\bSalesforce\b/g, '#Salesforce'],
  [/\bOracle\b/g, '#Oracle'],
  [/\bIBM\b/g, '#IBM'],
  [/\bSoftBank\b/g, '#SoftBank'],
  // Ljudi o kojima se najviše piše
  [/\bJensen Huang\b/g, '#JensenHuang'],
  [/\bSam Altman\b/g, '#SamAltman'],
  [/\bDario Amodei\b/g, '#DarioAmodei'],
  [/\bSundar Pichai\b/g, '#SundarPichai'],
  [/\bMark Zuckerberg\b|\bZuckerberg\b/g, '#Zuckerberg'],
  // Teme
  [/\bAI agents?\b|\bagentic\b|\bcoding agents?\b/gi, '#AIAgents'],
  [/\bMCP\b/g, '#MCP'],
  [/\bopen[- ]source\b|\bopen weights?\b/gi, '#OpenSource'],
  [/\bdata ?cent(?:er|re)s?\b/gi, '#DataCenters'],
  [/\bGPUs?\b|\bchips?\b|\bsemiconductors?\b/gi, '#AIChips'],
  [/\bcyber\w*|\bvulnerabilit\w+|\bhack(?:er|ers|ing|ed)?\b|\bsecurity\b/gi, '#Cybersecurity'],
  [/\brobots?\b|\brobotics\b|\bhumanoids?\b/gi, '#Robotics'],
  [/\bIPO\b/g, '#IPO'],
  [/\bAI Act\b/g, '#AIAct'],
  [/\bregulat\w+|\blawsuits?\b|\bcourt\b/gi, '#AIRegulation'],
];

/** Hashtag-ovi teme iz teksta, najčešći prvi (pa po prvom pominjanju), najviše `max`. */
export function temeHashtagovi(tekst, max = 4) {
  const nadjeni = [];
  for (const [izraz, tag] of RECNIK) {
    const pogodci = [...String(tekst ?? '').matchAll(izraz)];
    if (!pogodci.length) continue;
    const postoji = nadjeni.find((n) => n.tag === tag);
    if (postoji) postoji.broj += pogodci.length;
    else nadjeni.push({ tag, broj: pogodci.length, prvi: pogodci[0].index });
  }
  return nadjeni
    .sort((a, b) => b.broj - a.broj || a.prvi - b.prvi)
    .slice(0, max)
    .map((n) => n.tag);
}

/**
 * Spaja osnovne hashtag-ove formata ("#AI #AINews … #Shorts") sa temama iz teksta:
 * prvi osnovni (#AI), pa teme, pa ostali osnovni, bez duplikata, najviše `max` ukupno (#Shorts uvek ostaje na kraju).
 * Prazna osnova ostaje prazna (npr. Telegram opis bez hashtag-ova).
 */
export function hashtagovi(osnova, tekst, { max = 8, tema = 4 } = {}) {
  const osnovni = String(osnova ?? '').split(/\s+/).filter(Boolean);
  if (!osnovni.length) return '';
  const shorts = osnovni.filter((t) => t.toLowerCase() === '#shorts');
  const ostali = osnovni.filter((t) => t.toLowerCase() !== '#shorts');
  const redom = [ostali[0], ...temeHashtagovi(tekst, tema), ...ostali.slice(1)].filter(Boolean);
  const bezDuplikata = redom.filter((t, i) => redom.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i);
  return [...bezDuplikata.slice(0, max - shorts.length), ...shorts].join(' ');
}

/** Hashtag od imena alata ("GitHub Spec Kit" → #GitHubSpecKit, "llm 0.37" → #llm); prazno ako je ime predugo. */
export function tagAlata(naziv) {
  const reci = String(naziv ?? '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\bv?\d+(\.\d+)*\b/g, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const tag = reci.join('');
  return reci.length && reci.length <= 3 && tag.length <= 20 ? `#${tag}` : '';
}
