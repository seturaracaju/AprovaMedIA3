
import { GoogleGenAI } from "@google/genai";
import { UserRole } from '../types';
import * as dashboardService from './dashboardService';
import * as analyticsService from './analyticsService';

const MODEL_NAME = 'gemini-3-flash-preview';

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

// Funções de busca de contexto agora são chamadas apenas quando o usuário solicita explicitamente
export const getPlatformContext = async (userRole: UserRole): Promise<string> => {
    if (userRole.role === 'teacher') {
        const analytics = await dashboardService.getDashboardAnalytics();
        return `DADOS DA PLATAFORMA: Alunos: ${analytics.totalStudents}, Cursos: ${analytics.totalCourses}, Média: ${analytics.platformAverageScore}%, Assuntos Críticos: ${analytics.hardestSubjects.slice(0,3).map(s => s.name).join(', ')}`;
    } else {
        const analytics = await analyticsService.getStudentComprehensiveAnalytics(userRole.studentId);
        if (!analytics) return "Dados do aluno indisponíveis.";
        return `DADOS DO ALUNO: Progresso: ${analytics.overallProgress}%, Média Testes: ${analytics.testAverage}%, Fraquezas: ${analytics.weaknesses.slice(0,2).map(w => w.subjectName).join(', ')}`;
    }
};

export const getTutorResponse = async (
    userMessage: string, 
    userRole: UserRole, 
    history: {role: string, content: string}[],
    includeContext: boolean = false
): Promise<string> => {
    try {
        const ai = getAI();
        let contextData = '';

        if (includeContext) {
            contextData = await getPlatformContext(userRole);
        }

        // Limita o histórico para as últimas 6 mensagens para economizar tokens de input
        const recentHistory = history.slice(-6).map(h => `${h.role === 'user' ? 'Aluno' : 'Tutor'}: ${h.content}`).join('\n');

        const systemInstruction = userRole.role === 'teacher' 
            ? "Você é um Tutor Coordenador. Analise dados se fornecidos. Seja curto e direto."
            : `Você é o Tutor de ${userRole.studentName}. Seja motivador e foque em dicas de estudo.`;

        const prompt = `
            ${systemInstruction}
            
            ${contextData ? `\nCONTEXTO ATUAL:\n${contextData}\n` : '\n(Nenhum dado extra de desempenho foi enviado nesta mensagem para economizar tokens)\n'}

            HISTÓRICO RECENTE:
            ${recentHistory}

            PERGUNTA ATUAL:
            "${userMessage}"
        `;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
        });

        return response.text || "Não consegui gerar uma resposta.";

    } catch (error: any) {
        console.error("Erro Tutor:", error);
        return "Desculpe, tive um problema técnico. Tente novamente.";
    }
};

export const getInitialTutorMessage = (userRole: UserRole): string => {
     if (userRole.role === 'teacher') {
        return "Olá, Professor! Sou seu assistente de análise. Como posso ajudar com os dados da plataforma hoje?";
    } else {
        return `Olá, ${userRole.studentName}! Estou pronto para te ajudar a conquistar sua aprovação. O que vamos estudar?`;
    }
};
