
import { GoogleGenAI, Type } from "@google/genai";
import { QuizQuestion, TrueFlashcard } from '../types';

const MODEL_NAME = 'gemini-3-flash-preview';

// Helper para obter a instância da IA apenas quando necessário
const getAI = () => {
    // O Vite substituirá estas strings pelos valores reais durante o build
    // @ts-ignore
    const apiKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || 
                   // @ts-ignore
                   (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY);

    if (!apiKey) {
        console.error("ERRO: GEMINI_API_KEY não encontrada no ambiente.");
        throw new Error("Chave de API não configurada. Verifique os Secrets no AI Studio e faça um novo Deploy.");
    }
    return new GoogleGenAI({ apiKey: apiKey });
};

// Helper to clean JSON string from Markdown formatting
const cleanJson = (text: string): string => {
    if (!text) return "";
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(json)?/, "").replace(/```$/, "");
    }
    return cleaned.trim();
};

const quizQuestionSchema = {
    type: Type.OBJECT,
    properties: {
        question: { 
            type: Type.STRING, 
            description: "O texto INTEGRAL, LITERAL e ABSOLUTAMENTE COMPLETO do enunciado da questão. Copie palavra por palavra sem mudar nada." 
        },
        options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Lista das alternativas (A, B, C, D, E) copiadas NA ÍNTEGRA. NÃO resuma as respostas, mantenha cada vírgula do original."
        },
        correctAnswerIndex: { 
            type: Type.INTEGER, 
            description: "O índice (0-4) da resposta correta." 
        },
        explanation: {
            type: Type.STRING,
            description: "Comentário didático explicando a questão."
        }
    },
    required: ['question', 'options']
};

// Helper function to process a single chunk
const extractQuestionsFromChunk = async (chunkText: string): Promise<QuizQuestion[] | null> => {
    try {
        const ai = getAI();
        
        const prompt = `Você é um robô de transcrição de alta precisão para provas médicas. Sua função é converter texto bruto em JSON estruturado com 100% de fidelidade.

        DIRETRIZES DE RIGIDEZ TOTAL:
        1. ENUNCIADO: Copie o texto completo, incluindo casos clínicos, dados epidemiológicos e perguntas finais. NÃO mude nenhuma palavra.
        2. ALTERNATIVAS: Copie as alternativas EXATAMENTE como estão. Se a alternativa for longa, copie ela inteira. NÃO resuma.
        3. INTEGRALIDADE: Mantenha nomes de hospitais, anos da prova e bancas se estiverem no texto da questão.
        
        PROIBIÇÕES ABSOLUTAS:
        - PROIBIDO parafrasear.
        - PROIBIDO corrigir gramática ou digitação do original.
        - PROIBIDO encurtar frases para economizar espaço.
        - PROIBIDO inventar informações.
        
        TEXTO ORIGINAL PARA TRANSCRIÇÃO:
        """
        ${chunkText}
        """`;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: quizQuestionSchema,
                },
            },
        });

        const jsonString = response.text || "";
        if (!jsonString) return [];
        const parsed = JSON.parse(cleanJson(jsonString));
        
        return parsed.map((q: any) => ({
            question: q.question ? q.question.trim() : '',
            options: q.options || [],
            correctAnswerIndex: q.correctAnswerIndex === undefined ? null : q.correctAnswerIndex,
            explanation: q.explanation || '',
        })).filter((q: QuizQuestion) => q.question.length > 15 && q.options.length >= 2);

    } catch (error: any) {
        console.error("Erro ao extrair questões:", error);
        // Log more details if available
        if (error.message) console.error("Mensagem de erro da IA:", error.message);
        return [];
    }
};

export const extractQuestionsFromPdf = async (pdfText: string, focus: 'all' | 'end' = 'all'): Promise<QuizQuestion[] | null> => {
    let textToProcess = pdfText;
    if (focus === 'end') {
        const splitIndex = Math.floor(pdfText.length * 0.6);
        textToProcess = pdfText.substring(splitIndex);
    }

    const CHUNK_SIZE = 40000; 
    const CHUNK_OVERLAP = 2000;

    const chunks: string[] = [];
    if (textToProcess.length < CHUNK_SIZE) {
        chunks.push(textToProcess);
    } else {
        for (let i = 0; i < textToProcess.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
            chunks.push(textToProcess.substring(i, i + CHUNK_SIZE));
        }
    }
    
    try {
        const allQuestions: QuizQuestion[] = [];
        for (const chunk of chunks) {
            const result = await extractQuestionsFromChunk(chunk);
            if (result) allQuestions.push(...result);
        }
        return Array.from(new Map(allQuestions.map(q => [q.question.trim(), q])).values());
    } catch (error: any) {
        console.error("Erro ao processar chunks de PDF:", error);
        return null;
    }
};

export const generateExplanationsForQuestions = async (questions: QuizQuestion[]): Promise<QuizQuestion[]> => {
    const ai = getAI();
    const BATCH_SIZE = 4;
    const updatedQuestions = [...questions]; 

    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
        const chunk = questions.slice(i, i + BATCH_SIZE);
        
        const chunkForAI = chunk.map((q, idx) => ({
            id: idx,
            enunciado_original: q.question,
            alternativas_originais: q.options,
            gabarito_index: q.correctAnswerIndex !== null ? q.correctAnswerIndex : "Desconhecido"
        }));

        try {
            const prompt = `
            Você é um Professor de Medicina Sênior.
            Escreva um COMENTÁRIO DIDÁTICO para as questões abaixo.
            
            AVISO DE SEGURANÇA:
            Você está proibido de modificar o "enunciado_original" ou as "alternativas_originais".
            Sua saída deve conter APENAS o comentário pedagógico.
            
            QUESTÕES:
            ${JSON.stringify(chunkForAI)}
            `;

            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            explanations: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        id: { type: Type.INTEGER },
                                        explanation: { type: Type.STRING }
                                    },
                                    required: ['id', 'explanation']
                                }
                            }
                        },
                        required: ['explanations']
                    },
                },
            });

            const parsedData = JSON.parse(cleanJson(response.text || "{}"));
            const explanations = parsedData.explanations || [];

            explanations.forEach((item: any) => {
                const globalIndex = i + item.id;
                if (updatedQuestions[globalIndex]) {
                    updatedQuestions[globalIndex].explanation = item.explanation;
                }
            });

        } catch (e) {
            console.error(`Erro no lote ${i}:`, e);
        }
    }

    return updatedQuestions;
};

export const answerQuestion = async (pdfText: string, userQuestion: string): Promise<string> => {
    try {
        const ai = getAI();
        const prompt = `Responda com base no documento. Seja fiel aos termos técnicos do texto.
        
        TEXTO: ${pdfText.substring(0, 40000)}
        PERGUNTA: "${userQuestion}"`;
        const response = await ai.models.generateContent({ model: MODEL_NAME, contents: prompt });
        return response.text || "Sem resposta.";
    } catch { return "Erro no processamento."; }
};

export const transcribeImage = async (file: File): Promise<string> => {
    try {
        const ai = getAI();
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(file);
        });
        const base64Data = await base64Promise;
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [
                { text: "Transcreva o texto desta imagem médicos com fidelidade literal de 100%. NÃO resuma enunciados nem alternativas." },
                { inlineData: { mimeType: file.type, data: base64Data } }
            ]
        });
        return response.text || "";
    } catch { return ""; }
};

export const generateSummary = async (pdfText: string): Promise<string> => {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Crie um resumo médico deste texto:\n${pdfText.substring(0, 30000)}`,
        });
        return response.text || "Erro.";
    } catch { return "Erro."; }
};

export const generateSummaryFromQuestions = async (context: string): Promise<string> => {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Resumo didático baseado nestas questões:\n${context.substring(0, 20000)}`,
        });
        return response.text || "Erro.";
    } catch { return "Erro."; }
};

export const extractTrueFlashcards = async (pdfText: string): Promise<TrueFlashcard[]> => {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Crie flashcards P/R deste texto:\n${pdfText.substring(0, 30000)}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING },
                            answer: { type: Type.STRING },
                            tag: { type: Type.STRING },
                            mnemonic: { type: Type.STRING }
                        },
                        required: ['question', 'answer', 'tag']
                    },
                },
            },
        });
        return JSON.parse(cleanJson(response.text || "[]"));
    } catch { return []; }
};

export const refineFlashcardText = async (text: string, type: 'question' | 'answer'): Promise<string> => {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({ model: MODEL_NAME, contents: `Refine para concisão:\n${text}` });
        return response.text?.trim() || text;
    } catch { return text; }
};

export const processAnswerKey = async (answerKeyText: string): Promise<{ identifier: string; option: string; explanation?: string }[] | null> => {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Extraia gabarito JSON (identifier, option, explanation):\n${answerKeyText.substring(0, 20000)}`,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(cleanJson(response.text || "[]"));
    } catch { return null; }
};

export const getAIHint = async (question: string, options: string[]): Promise<string> => {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({ model: MODEL_NAME, contents: `Dica sutil para esta questão:\n${question}` });
        return response.text || "Dica indisponível.";
    } catch { return "Erro."; }
};

export const generateSimilarQuestion = async (originalQuestion: QuizQuestion): Promise<QuizQuestion | null> => {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Crie questão similar:\n${JSON.stringify(originalQuestion)}`,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(cleanJson(response.text || "null"));
    } catch { return null; }
};

export const generateStudyInsights = async (analyticsData: any): Promise<string> => {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({ model: MODEL_NAME, contents: `Insights de estudo:\n${JSON.stringify(analyticsData)}` });
        return response.text || "Continue estudando.";
    } catch { return "Erro."; }
};
