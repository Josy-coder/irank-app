import { useState, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ValidationResult {
  isAppropriate: boolean;
  issues?: string[];
  suggestions?: string[];
  confidence: number;
}

interface FactCheckResult {
  isValid: boolean;
  result: 'true' | 'false' | 'partially_true' | 'inconclusive';
  sources?: string[];
  explanation?: string;
  confidence: number;
}

interface BiasCheckResult {
  hasBias: boolean;
  biasType?: string[];
  suggestions?: string[];
  confidence: number;
}

interface GeminiError {
  code: string;
  message: string;
  isRetryable: boolean;
}

export function useGemini() {
  const [isValidating, setIsValidating] = useState(false);
  const [isFactChecking, setIsFactChecking] = useState(false);
  const [isBiasChecking, setIsBiasChecking] = useState(false);
  const [lastValidation, setLastValidation] = useState<ValidationResult | null>(null);
  const [lastFactCheck, setLastFactCheck] = useState<FactCheckResult | null>(null);
  const [lastBiasCheck, setLastBiasCheck] = useState<BiasCheckResult | null>(null);

  const handleGeminiError = useCallback((error: any): GeminiError => {
    console.error('Gemini API error:', error);

    if (error.status || error.code) {
      const status = error.status || error.code;

      switch (status) {
        case 400:
          return {
            code: 'INVALID_REQUEST',
            message: 'Request format error - continuing without AI assistance',
            isRetryable: false
          };
        case 403:
          return {
            code: 'PERMISSION_DENIED',
            message: 'API key issue - continuing without AI assistance',
            isRetryable: false
          };
        case 429:
          return {
            code: 'RATE_LIMITED',
            message: 'Rate limit exceeded - please try again later',
            isRetryable: true
          };
        case 500:
          return {
            code: 'INTERNAL_ERROR',
            message: 'Gemini service error - continuing without AI assistance',
            isRetryable: true
          };
        case 503:
          return {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Gemini temporarily unavailable - continuing without AI assistance',
            isRetryable: true
          };
        case 504:
          return {
            code: 'TIMEOUT',
            message: 'Request timeout - try with shorter content',
            isRetryable: true
          };
        default:
          return {
            code: 'UNKNOWN_ERROR',
            message: 'AI service unavailable - continuing without AI assistance',
            isRetryable: true
          };
      }
    }

    return {
      code: 'NETWORK_ERROR',
      message: 'Network error - continuing without AI assistance',
      isRetryable: true
    };
  }, []);

  const getGeminiModel = useCallback(() => {
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);
    return genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  }, []);

  const validateFeedback = useCallback(async (
    feedback: string,
    speakerComments: Record<string, string> = {},
    judgeNotes: string = ''
  ): Promise<ValidationResult> => {
    setIsValidating(true);

    try {
      const model = getGeminiModel();
      const allComments = Object.values(speakerComments).join('\n');
      const combinedFeedback = `${feedback}\n${allComments}\n${judgeNotes}`.trim();

      if (!combinedFeedback) {
        return { isAppropriate: true, confidence: 1 };
      }

      const prompt = `
You are a professional content moderator for academic debate tournaments. Your task is to analyze judge feedback and comments to ensure they are:

1. **Professional and Constructive**: Language should be respectful, educational, and focused on improvement
2. **Appropriate for Students**: Content suitable for high school/university students and educational environment
3. **Non-Discriminatory**: Free from bias based on race, gender, religion, nationality, or personal characteristics
4. **Factual and Fair**: Focused on debate performance rather than personal attacks
5. **Encouraging**: Even critical feedback should be constructive and motivational

**ANALYZE THE FOLLOWING FEEDBACK:**
"""
${combinedFeedback}
"""

**EVALUATION CRITERIA:**
- ❌ INAPPROPRIATE: Personal attacks, discriminatory language, inappropriate humor, excessive negativity, unprofessional tone, bias based on personal characteristics
- ✅ APPROPRIATE: Constructive criticism, specific improvement suggestions, professional language, balanced feedback, performance-focused comments

**RESPONSE FORMAT (JSON only):**
{
  "isAppropriate": boolean,
  "confidence": number (0-1),
  "issues": ["list of specific issues found"],
  "suggestions": ["specific improvement suggestions for problematic parts"],
  "reasoning": "brief explanation of decision"
}

**IMPORTANT:**
- Be strict but fair - academic standards should be high
- Consider cultural sensitivity for international tournaments
- Focus on intent and impact, not just specific words
- Provide specific, actionable feedback for improvements
- Only flag content that would genuinely be inappropriate in an educational setting

Respond with valid JSON only:`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      const jsonMatch = responseText.match(/\{[\s\S]*}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from Gemini');
      }

      const validation: ValidationResult = JSON.parse(jsonMatch[0]);

      const finalResult: ValidationResult = {
        isAppropriate: validation.isAppropriate ?? true,
        confidence: Math.min(Math.max(validation.confidence ?? 0.5, 0), 1),
        issues: validation.issues ?? [],
        suggestions: validation.suggestions ?? [],
      };

      setLastValidation(finalResult);
      return finalResult;

    } catch (error: any) {
      const geminiError = handleGeminiError(error);

      const fallbackResult = performFallbackValidation(feedback, speakerComments, judgeNotes);
      setLastValidation(fallbackResult);

      console.warn(`Gemini validation failed (${geminiError.code}): ${geminiError.message}`);
      return fallbackResult;
    } finally {
      setIsValidating(false);
    }
  }, [getGeminiModel, handleGeminiError]);

  const factCheckClaim = useCallback(async (
    claim: string,
    context?: string
  ): Promise<FactCheckResult> => {
    setIsFactChecking(true);

    try {
      const model = getGeminiModel();

      const prompt = `
You are a fact-checking assistant for academic debate tournaments. Analyze the following claim for accuracy.

**CLAIM TO CHECK:**
"""
${claim}
"""

${context ? `**CONTEXT:**\n"""${context}"""` : ''}

**INSTRUCTIONS:**
1. Evaluate the factual accuracy of the claim
2. Consider that some claims may be opinions or interpretations
3. Provide sources when possible, but acknowledge when information cannot be verified online
4. Be honest about limitations - not everything can be fact-checked definitively

**RESPONSE FORMAT (JSON only):**
{
  "result": "true" | "false" | "partially_true" | "inconclusive",
  "confidence": number (0-1),
  "explanation": "detailed explanation of the assessment",
  "sources": ["array of source descriptions or URLs if available"],
  "reasoning": "brief explanation of how you reached this conclusion"
}

**RESULT DEFINITIONS:**
- "true": Claim is factually accurate
- "false": Claim is factually incorrect
- "partially_true": Claim has some accurate elements but also inaccuracies
- "inconclusive": Cannot be definitively verified (opinion, insufficient data, etc.)

Respond with valid JSON only:`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      const jsonMatch = responseText.match(/\{[\s\S]*}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from Gemini');
      }

      const factCheck = JSON.parse(jsonMatch[0]);

      const finalResult: FactCheckResult = {
        isValid: factCheck.result === 'true' || factCheck.result === 'partially_true',
        result: factCheck.result,
        sources: factCheck.sources ?? [],
        explanation: factCheck.explanation,
        confidence: Math.min(Math.max(factCheck.confidence ?? 0.5, 0), 1),
      };

      setLastFactCheck(finalResult);
      return finalResult;

    } catch (error: any) {
      const geminiError = handleGeminiError(error);

      const fallbackResult: FactCheckResult = {
        isValid: false,
        result: 'inconclusive',
        explanation: `Unable to verify claim: ${geminiError.message}`,
        confidence: 0,
      };

      setLastFactCheck(fallbackResult);
      console.warn(`Gemini fact-check failed (${geminiError.code}): ${geminiError.message}`);
      return fallbackResult;
    } finally {
      setIsFactChecking(false);
    }
  }, [getGeminiModel, handleGeminiError]);

  const checkBias = useCallback(async (
    content: string,
    contentType: 'feedback' | 'comment' | 'argument' = 'feedback'
  ): Promise<BiasCheckResult> => {
    setIsBiasChecking(true);

    try {
      const model = getGeminiModel();

      const prompt = `
You are a bias detection assistant for academic debate tournaments. Analyze the following ${contentType} for potential bias.

**CONTENT TO ANALYZE:**
"""
${content}
"""

**TYPES OF BIAS TO DETECT:**
1. **Identity Bias**: Based on race, gender, religion, nationality, age, appearance
2. **Confirmation Bias**: Favoring information that confirms pre-existing beliefs
3. **Anchoring Bias**: Over-relying on first impressions or initial information
4. **Linguistic Bias**: Bias based on accent, language proficiency, speaking style
5. **Cultural Bias**: Assumptions based on cultural background or practices

**RESPONSE FORMAT (JSON only):**
{
  "hasBias": boolean,
  "confidence": number (0-1),
  "biasTypes": ["array of detected bias types"],
  "suggestions": ["specific suggestions for more neutral language"],
  "reasoning": "explanation of detected bias or why content is unbiased"
}

**GUIDELINES:**
- Focus on subtle bias that the author may not be aware of
- Consider academic debate context - focus on argumentation quality
- Provide constructive suggestions for improvement
- Be careful not to over-flag normal evaluation language

Respond with valid JSON only:`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      const jsonMatch = responseText.match(/\{[\s\S]*}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from Gemini');
      }

      const biasCheck = JSON.parse(jsonMatch[0]);

      const finalResult: BiasCheckResult = {
        hasBias: biasCheck.hasBias ?? false,
        biasType: biasCheck.biasTypes ?? [],
        suggestions: biasCheck.suggestions ?? [],
        confidence: Math.min(Math.max(biasCheck.confidence ?? 0.5, 0), 1),
      };

      setLastBiasCheck(finalResult);
      return finalResult;

    } catch (error: any) {
      const geminiError = handleGeminiError(error);

      const fallbackResult: BiasCheckResult = {
        hasBias: false,
        suggestions: [`Unable to check for bias: ${geminiError.message}`],
        confidence: 0,
      };

      setLastBiasCheck(fallbackResult);
      console.warn(`Gemini bias check failed (${geminiError.code}): ${geminiError.message}`);
      return fallbackResult;
    } finally {
      setIsBiasChecking(false);
    }
  }, [getGeminiModel, handleGeminiError]);

  return {

    validateFeedback,
    factCheckClaim,
    checkBias,

    isValidating,
    isFactChecking,
    isBiasChecking,

    lastValidation,
    lastFactCheck,
    lastBiasCheck,

    handleGeminiError,
  };
}

function performFallbackValidation(
  feedback: string,
  speakerComments: Record<string, string>,
  judgeNotes: string
): ValidationResult {
  const combinedText = `${feedback} ${Object.values(speakerComments).join(' ')} ${judgeNotes}`.toLowerCase();

  const inappropriatePatterns = [
    /\b(stupid|idiot|dumb|moron|retard)\b/,
    /\b(hate|despise|disgusting)\b/,
    /\b(ugly|fat|skinny)\b/,
    /\b(shut up|garbage|trash|worthless)\b/,
    /\b(racist|sexist)\b/,
    /\b(kill|die|suicide)\b/,
  ];

  const profanityPatterns = [
    /\b(damn|hell|crap|suck)\b/,
    /f[*\-_]?u[*\-_]?c[*\-_]?k/,
    /s[*\-_]?h[*\-_]?i[*\-_]?t/,
    /b[*\-_]?i[*\-_]?t[*\-_]?c[*\-_]?h/,
  ];

  const issues: string[] = [];
  let isAppropriate = true;

  inappropriatePatterns.forEach(pattern => {
    if (pattern.test(combinedText)) {
      issues.push('Contains inappropriate or offensive language');
      isAppropriate = false;
    }
  });

  profanityPatterns.forEach(pattern => {
    if (pattern.test(combinedText)) {
      issues.push('Contains unprofessional language');
    }
  });

  const negativeWords = combinedText.match(/\b(bad|poor|terrible|awful|horrible|worst|failed|failure)\b/g);
  if (negativeWords && negativeWords.length > 5) {
    issues.push('Feedback appears overly negative - consider more balanced approach');
  }

  return {
    isAppropriate,
    confidence: 0.7,
    issues,
    suggestions: issues.length > 0 ? [
      'Use more constructive and professional language',
      'Focus on specific improvements rather than general criticism',
      'Maintain respectful tone appropriate for educational setting'
    ] : [],
  };
}