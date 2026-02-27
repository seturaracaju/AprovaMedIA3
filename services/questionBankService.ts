
import { supabase } from './supabaseClient';
import { Course, Module, Discipline, QuestionSet, QuestionBank, QuizQuestion } from '../types';

export const getQuestionBank = async (): Promise<QuestionBank> => {
    // Busca otimizada: Não traz o JSON de questions
    const { data, error } = await supabase
        .from('question_sets')
        .select('id, discipline_id, subject_name, image_url, created_at, relevance, incidence, difficulty, question_count')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro ao ler a tabela question_sets:", error.message || error);
        return {};
    }
    if (!data) return {};

    const bank: QuestionBank = {};
    for (const set of data) {
        bank[set.id] = {
            id: set.id,
            disciplineId: set.discipline_id,
            subjectName: set.subject_name,
            questions: [], // Vazio propositalmente para não pesar. Carregar sob demanda.
            image_url: set.image_url,
            createdAt: set.created_at,
            relevance: set.relevance,
            incidence: set.incidence,
            difficulty: set.difficulty,
            question_count: set.question_count // Usa a coluna virtual do SQL
        };
    }
    return bank;
};

// Esta função PRECISA trazer as questões, pois é usada para o detalhe
export const getQuestionSetById = async (id: string): Promise<QuestionSet | null> => {
    const { data, error } = await supabase
        .from('question_sets')
        .select('*') // Aqui precisamos de tudo, inclusive 'questions'
        .eq('id', id)
        .single();
    
    if (error) {
        console.error(`Error fetching question set ${id}:`, error.message);
        return null;
    }
    
    return {
        id: data.id,
        disciplineId: data.discipline_id,
        subjectName: data.subject_name,
        questions: data.questions,
        image_url: data.image_url,
        createdAt: data.created_at,
        relevance: data.relevance,
        incidence: data.incidence,
        difficulty: data.difficulty
    } as QuestionSet;
};

export const getQuestionSetsByDiscipline = async (disciplineId: string): Promise<QuestionSet[]> => {
    // Busca otimizada para listagens
    const { data, error } = await supabase
        .from('question_sets')
        .select('id, discipline_id, subject_name, image_url, created_at, relevance, incidence, difficulty, question_count')
        .eq('discipline_id', disciplineId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching question sets by discipline:", error.message);
        return [];
    }

    return (data || []).map((set: any) => ({
        id: set.id,
        disciplineId: set.discipline_id,
        subjectName: set.subject_name,
        questions: [], // Lazy loading
        image_url: set.image_url,
        createdAt: set.created_at,
        relevance: set.relevance,
        incidence: set.incidence,
        difficulty: set.difficulty,
        question_count: set.question_count
    }));
};

// --- CORREÇÃO PRINCIPAL: Otimização de Tráfego ---
export const getStructuredQuestionBank = async (): Promise<Course[]> => {
    try {
        // Busca todas as entidades em paralelo, mas SELECIONANDO COLUNAS ESPECÍFICAS
        // Evita baixar o JSON 'questions'
        const [coursesRes, modulesRes, disciplinesRes, qSetsRes] = await Promise.all([
            supabase.from('courses').select('id, name, image_url').order('name'),
            supabase.from('modules').select('id, course_id, name, image_url').order('name'),
            supabase.from('disciplines').select('id, module_id, name, image_url').order('name'),
            supabase.from('question_sets')
                .select('id, discipline_id, subject_name, image_url, created_at, relevance, incidence, difficulty, question_count')
                .order('created_at', { ascending: false })
        ]);

        if (coursesRes.error) throw coursesRes.error;
        
        const courses = coursesRes.data || [];
        const modules = modulesRes.data || [];
        const disciplines = disciplinesRes.data || [];
        const qSets = qSetsRes.data || [];

        // Reconstrói a árvore hierárquica manualmente
        const structuredData: Course[] = courses.map(course => {
            const courseModules = modules
                .filter(m => m.course_id === course.id)
                .map(mod => {
                    const modDisciplines = disciplines
                        .filter(d => d.module_id === mod.id)
                        .map(disc => {
                            const discQSets = qSets
                                .filter(qs => qs.discipline_id === disc.id)
                                .map(qs => ({
                                    id: qs.id,
                                    disciplineId: qs.discipline_id,
                                    subjectName: qs.subject_name, 
                                    questions: [], // Placeholder vazio para economizar banda
                                    image_url: qs.image_url,
                                    createdAt: qs.created_at,
                                    relevance: qs.relevance,
                                    incidence: qs.incidence,
                                    difficulty: qs.difficulty,
                                    question_count: qs.question_count
                                }));

                            return {
                                ...disc,
                                moduleId: disc.module_id,
                                question_sets: discQSets
                            };
                        });

                    return {
                        ...mod,
                        courseId: mod.course_id,
                        disciplines: modDisciplines
                    };
                });

            return {
                ...course,
                modules: courseModules
            };
        });

        return structuredData;

    } catch (error: any) {
        console.error("Critical Error fetching structured question bank:", error.message || error);
        return [];
    }
};

export const saveQuestionSet = async (disciplineId: string, subjectName: string, questions: QuizQuestion[]): Promise<QuestionSet | null> => {
    const { data, error } = await supabase.rpc('save_question_set', {
        p_discipline_id: disciplineId,
        p_subject_name: subjectName,
        p_questions: questions,
    }).select().single();

    if (error) {
        console.error('Error saving question set:', error.message || error);
        return null;
    }
    return data;
};

export const appendQuestionsToSet = async (questionSetId: string, newQuestions: QuizQuestion[]): Promise<boolean> => {
    try {
        // 1. Fetch existing questions first
        const { data: currentSet, error: fetchError } = await supabase
            .from('question_sets')
            .select('questions')
            .eq('id', questionSetId)
            .single();

        if (fetchError || !currentSet) throw new Error("Could not fetch existing questions");

        const existingQuestions = currentSet.questions || [];
        const mergedQuestions = [...existingQuestions, ...newQuestions];

        // 2. Update with merged array
        const { error: updateError } = await supabase
            .from('question_sets')
            .update({ questions: mergedQuestions })
            .eq('id', questionSetId);

        if (updateError) throw updateError;
        return true;

    } catch (e) {
        console.error("Error appending questions:", e);
        return false;
    }
};

export const createEmptyQuestionSet = async (disciplineId: string, subjectName: string): Promise<QuestionSet | null> => {
    const { data, error } = await supabase
        .from('question_sets')
        .insert({
            discipline_id: disciplineId,
            subject_name: subjectName,
            questions: [],
            question_count: 0
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating empty question set:', error);
        throw error;
    }

    return data ? {
        id: data.id,
        disciplineId: data.discipline_id,
        subjectName: data.subject_name,
        questions: data.questions || [],
        createdAt: data.created_at,
        imageUrl: data.image_url,
        question_count: data.question_count
    } : null;
};

export const updateQuestionSetDetails = async (id: string, updates: { subjectName?: string; imageUrl?: string }): Promise<QuestionSet | null> => {
    const updatePayload: { subject_name?: string; image_url?: string } = {};
    if (updates.subjectName) {
        updatePayload.subject_name = updates.subjectName;
    }
    if (updates.imageUrl !== undefined) {
        updatePayload.image_url = updates.imageUrl;
    }

    if (Object.keys(updatePayload).length === 0) {
        const { data } = await supabase.from('question_sets').select().eq('id', id).single();
        return data;
    }

    const { data, error } = await supabase
        .from('question_sets')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
    
    if (error) { 
        console.error('Error updating question set details:', error.message || error); 
        return null; 
    }
    return data;
};

export const updateQuestionSetQuestions = async (id: string, questions: QuizQuestion[]): Promise<boolean> => {
    if (!Array.isArray(questions)) {
        console.error("Invalid questions format provided to updateQuestionSetQuestions");
        return false;
    }

    const { error } = await supabase
        .from('question_sets')
        .update({ questions: questions })
        .eq('id', id);

    if (error) { 
        console.error('CRITICAL: Error updating question set questions:', error.message || error); 
        return false; 
    }
    
    console.log(`Question set ${id} updated successfully.`);
    return true;
};

export const deleteQuestionSet = async (id: string): Promise<void> => {
    console.log(`Iniciando exclusão robusta do assunto ${id}...`);

    try {
        const { data: sessions } = await supabase
            .from('flashcard_sessions')
            .select('id')
            .eq('question_set_id', id);

        if (sessions && sessions.length > 0) {
            const sessionIds = sessions.map(s => s.id);
            await supabase.from('flashcard_responses').delete().in('session_id', sessionIds);
            await supabase.from('flashcard_sessions').delete().in('id', sessionIds);
        }

        await supabase.from('student_question_ratings').delete().eq('question_set_id', id);
        await supabase.from('student_library').delete().eq('question_set_id', id);
        await supabase.from('flashcard_progress').delete().eq('question_set_id', id);
        await supabase.from('marketplace_items').delete().match({ content_id: id, content_type: 'question_set' });

        const { error } = await supabase.from('question_sets').delete().eq('id', id);
        
        if (error) {
            throw new Error(`Erro de banco de dados: ${error.message}`);
        }
        
    } catch (error: any) {
        console.error('Erro crítico durante a exclusão:', error);
        throw new Error(`Falha na exclusão: ${error.message || 'Erro desconhecido'}`);
    }
};

export const moveQuestionSet = async (questionSetId: string, newDisciplineId: string): Promise<boolean> => {
    const { error } = await supabase
        .from('question_sets')
        .update({ discipline_id: newDisciplineId })
        .eq('id', questionSetId);
    
    if (error) {
        console.error('Error moving question set:', error.message || error);
        return false;
    }
    return true;
};

export const moveQuestionsBetweenSets = async (
    sourceSetId: string,
    targetSetId: string,
    questionsToMove: QuizQuestion[]
): Promise<boolean> => {
    try {
        // 1. Carrega ambos os conjuntos
        const [sourceRes, targetRes] = await Promise.all([
            supabase.from('question_sets').select('questions').eq('id', sourceSetId).single(),
            supabase.from('question_sets').select('questions').eq('id', targetSetId).single()
        ]);

        if (sourceRes.error || targetRes.error) throw new Error("Erro ao carregar os conjuntos de questões.");

        const sourceQuestions: QuizQuestion[] = sourceRes.data.questions || [];
        const targetQuestions: QuizQuestion[] = targetRes.data.questions || [];

        // 2. Remove da origem (comparando por texto da pergunta como ID único)
        const moveTexts = new Set(questionsToMove.map(q => q.question));
        const updatedSource = sourceQuestions.filter(q => !moveTexts.has(q.question));

        // 3. Adiciona ao final do destino
        const updatedTarget = [...targetQuestions, ...questionsToMove];

        // 4. Salva ambos (idealmente em transação, mas Supabase JS faz sequencial)
        const { error: err1 } = await supabase.from('question_sets').update({ questions: updatedSource }).eq('id', sourceSetId);
        if (err1) throw err1;

        const { error: err2 } = await supabase.from('question_sets').update({ questions: updatedTarget }).eq('id', targetSetId);
        if (err2) throw err2;

        return true;
    } catch (error) {
        console.error("Erro ao transplantar questões:", error);
        return false;
    }
};
