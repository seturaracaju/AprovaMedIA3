
import React, { useState, useEffect, useMemo } from 'react';
import { XIcon, MoveIcon } from './IconComponents';
import { Course, Module, Discipline, QuestionSet, QuizQuestion } from '../types';
import * as questionBankService from '../services/questionBankService';

interface MoveQuestionsModalProps {
    sourceSetId: string;
    questionsToMove: QuizQuestion[];
    structuredData: Course[];
    onClose: () => void;
    onSuccess: () => void;
}

const MoveQuestionsModal: React.FC<MoveQuestionsModalProps> = ({ 
    sourceSetId, 
    questionsToMove, 
    structuredData, 
    onClose, 
    onSuccess 
}) => {
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [selectedModuleId, setSelectedModuleId] = useState('');
    const [selectedDisciplineId, setSelectedDisciplineId] = useState('');
    const [selectedTargetSetId, setSelectedTargetSetId] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [availableSets, setAvailableSets] = useState<QuestionSet[]>([]);
    const [isLoadingSets, setIsLoadingSets] = useState(false);

    // Filtered data based on selection
    const modules = useMemo(() => 
        structuredData.find(c => c.id === selectedCourseId)?.modules || [], 
    [selectedCourseId, structuredData]);

    const disciplines = useMemo(() => 
        modules.find(m => m.id === selectedModuleId)?.disciplines || [], 
    [selectedModuleId, modules]);

    useEffect(() => {
        if (selectedDisciplineId) {
            setIsLoadingSets(true);
            questionBankService.getQuestionSetsByDiscipline(selectedDisciplineId)
                .then(sets => {
                    // Não mostra o próprio assunto de origem como destino
                    setAvailableSets(sets.filter(s => s.id !== sourceSetId));
                    setIsLoadingSets(false);
                });
        } else {
            setAvailableSets([]);
        }
    }, [selectedDisciplineId, sourceSetId]);

    const handleConfirm = async () => {
        if (!selectedTargetSetId) {
            alert("Por favor, selecione o assunto de destino.");
            return;
        }

        setIsSaving(true);
        const success = await questionBankService.moveQuestionsBetweenSets(
            sourceSetId,
            selectedTargetSetId,
            questionsToMove
        );

        if (success) {
            alert(`${questionsToMove.length} questão(ões) movida(s) com sucesso!`);
            onSuccess();
        } else {
            alert("Houve um erro ao mover as questões.");
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-scaleUp" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <MoveIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">Mover Questões</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 transition-colors">
                        <XIcon className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                        <p className="text-sm text-gray-600">Você está movendo <span className="font-bold text-primary">{questionsToMove.length} questão(ões)</span> selecionada(s).</p>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Destino Hierárquico</label>
                        <div className="grid grid-cols-1 gap-3">
                            <select
                                value={selectedCourseId}
                                onChange={(e) => { setSelectedCourseId(e.target.value); setSelectedModuleId(''); setSelectedDisciplineId(''); setSelectedTargetSetId(''); }}
                                className="w-full p-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm shadow-sm"
                            >
                                <option value="">1. Selecione o Curso</option>
                                {structuredData.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
                            </select>

                            <select
                                value={selectedModuleId}
                                onChange={(e) => { setSelectedModuleId(e.target.value); setSelectedDisciplineId(''); setSelectedTargetSetId(''); }}
                                className="w-full p-3 border border-gray-300 rounded-xl bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm shadow-sm"
                                disabled={!selectedCourseId}
                            >
                                <option value="">2. Selecione o Módulo</option>
                                {modules.map(module => <option key={module.id} value={module.id}>{module.name}</option>)}
                            </select>

                            <select
                                value={selectedDisciplineId}
                                onChange={(e) => { setSelectedDisciplineId(e.target.value); setSelectedTargetSetId(''); }}
                                className="w-full p-3 border border-gray-300 rounded-xl bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm shadow-sm"
                                disabled={!selectedModuleId}
                            >
                                <option value="">3. Selecione a Disciplina</option>
                                {disciplines.map(discipline => <option key={discipline.id} value={discipline.id}>{discipline.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Assunto de Destino</label>
                        <select
                            value={selectedTargetSetId}
                            onChange={(e) => setSelectedTargetSetId(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-xl bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm font-bold text-primary shadow-sm"
                            disabled={!selectedDisciplineId || isLoadingSets}
                        >
                            <option value="">{isLoadingSets ? "Buscando assuntos..." : "4. Selecione o Assunto de Destino"}</option>
                            {availableSets.map(set => (
                                <option key={set.id} value={set.id}>{set.subjectName} ({set.question_count || 0} Qs)</option>
                            ))}
                        </select>
                        {selectedDisciplineId && !isLoadingSets && availableSets.length === 0 && (
                            <p className="text-xs text-red-500 mt-1 italic">Nenhum outro assunto encontrado nesta disciplina.</p>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3 border-t">
                    <button 
                        onClick={onClose} 
                        className="px-6 py-2.5 text-gray-600 font-semibold hover:bg-gray-200 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSaving || !selectedTargetSetId}
                        className="px-8 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all disabled:bg-gray-300 disabled:shadow-none shadow-lg shadow-primary/20 flex items-center gap-2"
                    >
                        {isSaving ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <MoveIcon className="w-5 h-5" />
                        )}
                        {isSaving ? 'Movendo...' : 'Confirmar Transferência'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MoveQuestionsModal;
