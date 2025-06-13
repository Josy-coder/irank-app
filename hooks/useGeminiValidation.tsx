import { useState, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ValidationResult {
  isAppropriate: boolean;
  issues?: string[];
  suggestions?: string[];
  confidence: number;
}

export function useGeminiValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidation, setLastValidation] = useState<ValidationResult | null>(null);

  const validateFeedback = useCallback(async (
    feedback: string,
    speakerComments: Record<string, string> = {},
    judgeNotes: string = ''
  ): Promise<ValidationResult> => {
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      console.warn('Gemini API key not found, skipping validation');
      return { isAppropriate: true, confidence: 0 };
    }

    setIsValidating(true);

    try {
      const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

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

    } catch (error) {
      console.error('Gemini validation error:', error);

      const fallbackResult = performFallbackValidation(feedback, speakerComments, judgeNotes);
      setLastValidation(fallbackResult);
      return fallbackResult;
    } finally {
      setIsValidating(false);
    }
  }, []);

  return {
    validateFeedback,
    isValidating,
    lastValidation,
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