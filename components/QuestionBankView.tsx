
import React, { useState } from 'react';
import { QuizQuestion } from '../types';
import { SparklesIcon, LayersIcon, SaveIcon, PlusCircleIcon, RefreshCwIcon, ArrowLeftIcon, ClipboardListIcon } from './IconComponents';

interface QuestionBankViewProps {
    questions: QuizQuestion[] | null;
    isExtracting: boolean;
    onExtract: (mode: 'replace' | 'append', focus: 'all' | 'end') => void;
    onStudy: () => void;
    onSave: () => void;
    selectedIndices: Set<number>;
    onSelectionChange: (index: number) => void;
    onSelectAll: (checked: boolean) => void;
}

const QuestionBankView: React.FC<QuestionBankViewProps> = ({
    questions,
    isExtracting,
    onExtract,
    onStudy,
    onSave,
    selectedIndices,
    onSelectionChange,
    onSelectAll,
}) => {
    const areAllSelected = questions ? selectedIndices.size === questions.length && questions.length > 0 : false;
    const numSelected = selectedIndices.size;
    
    // Configurações de extração
    const [extractionMode, setExtractionMode] = useState<'replace' | 'append'>('replace');
    const [readFocus, setReadFocus] = useState<'all' | 'end'>('all');

    const handleExtractClick = () => {
        onExtract(extractionMode, readFocus);
    };

    return (
        <div className="flex-grow flex flex-col h-full">
            {/* Se não houver questões e não estiver extraindo, mostra o empty state */}
            {questions === null && !isExtracting && (
                <div className="flex-grow flex flex-col items-center justify-center p-8 text-center animate-fadeIn">
                    <div className="p-4 bg-primary/10 rounded-full mb-4">
                        <SparklesIcon className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Crie um Banco de Questões de Estudo</h3>
                    <p className="text-gray-600 max-w-sm mb-6">
                        Encontre e extraia automaticamente questões do seu PDF para construir um banco de questões interativo.
                    </p>
                    
                    {/* Controls */}
                    <div className="w-full max-w-xs space-y-3 mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Estratégia</label>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button onClick={() => setExtractionMode('replace')} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${extractionMode === 'replace' ? 'bg-white text-primary shadow' : 'text-gray-500'}`}>Novo</button>
                                <button onClick={() => setExtractionMode('append')} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${extractionMode === 'append' ? 'bg-white text-primary shadow' : 'text-gray-500'}`}>Adicionar</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Alcance da Leitura</label>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button onClick={() => setReadFocus('all')} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${readFocus === 'all' ? 'bg-white text-primary shadow' : 'text-gray-500'}`}>Todo o PDF</button>
                                <button onClick={() => setReadFocus('end')} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${readFocus === 'end' ? 'bg-white text-primary shadow' : 'text-gray-500'}`}>Apenas Final</button>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleExtractClick}
                        disabled={isExtracting}
                        className="w-full max-w-xs px-4 py-3 bg-primary text-white font-semibold rounded-lg flex items-center justify-center gap-2 hover:bg-primary-dark transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg"
                    >
                        <SparklesIcon className="w-5 h-5" />
                        <span>Extrair Questões</span>
                    </button>
                </div>
            )}
            
            {/* Loading State */}
            {isExtracting && (
                 <div className="flex-grow flex flex-col items-center justify-center p-8 text-center animate-fadeIn">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-600 font-semibold mb-2">Analisando o PDF...</p>
                    <p className="text-sm text-gray-400">
                        {readFocus === 'end' ? 'Focando nos últimos 40% do documento.' : 'Lendo o documento completo.'}
                    </p>
                 </div>
            )}

            {/* Results State */}
            {questions && !isExtracting && (
                <div className="flex-grow overflow-y-auto p-6 bg-gray-50 flex flex-col">
                     <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">Questões ({questions.length})</h2>
                            <p className="text-xs text-gray-500">Selecione para salvar ou estudar.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Mini Extract Button for Appending */}
                            <div className="flex gap-1 mr-2">
                                <button 
                                    onClick={() => onExtract('append', 'end')}
                                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors border border-transparent hover:border-primary/20"
                                    title="Tentar ler o final do PDF e adicionar (Correção de Falhas)"
                                >
                                    <ArrowLeftIcon className="w-5 h-5 rotate-180" /> {/* Simula icone de 'final' */}
                                </button>
                                <button 
                                    onClick={() => onExtract('replace', 'all')}
                                    className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                                    title="Reiniciar Extração (Substituir tudo)"
                                >
                                    <RefreshCwIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <button 
                                onClick={onSave}
                                disabled={numSelected === 0}
                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                <SaveIcon className="w-4 h-4"/>
                                Salvar ({numSelected})
                            </button>
                            <button 
                                onClick={onStudy}
                                disabled={numSelected === 0}
                                className="px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                            >
                                <LayersIcon className="w-4 h-4"/>
                                Estudar ({numSelected})
                            </button>
                        </div>
                    </div>

                    {questions.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 shadow-sm sticky top-0 z-10">
                                <input 
                                    type="checkbox"
                                    checked={areAllSelected}
                                    onChange={(e) => onSelectAll(e.target.checked)}
                                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                />
                                <label className="font-bold text-gray-700 cursor-pointer text-sm">Selecionar Todas as Questões</label>
                            </div>
                            {questions.map((q, index) => (
                                <div key={index} className={`p-4 rounded-xl border transition-all ${selectedIndices.has(index) ? 'bg-primary/5 border-primary shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                                    <div className="flex items-start gap-4">
                                         <input 
                                            type="checkbox"
                                            checked={selectedIndices.has(index)}
                                            onChange={() => onSelectionChange(index)}
                                            className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary mt-1 flex-shrink-0 cursor-pointer"
                                        />
                                        <div className="flex-grow">
                                            <p className="font-semibold mb-3 text-gray-800 text-sm leading-relaxed"><span className="text-primary font-bold mr-1">#{index + 1}</span> {q.question}</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {q.options.map((opt, i) => (
                                                    <div key={i} className={`text-xs p-2 rounded border flex items-center gap-2 ${i === q.correctAnswerIndex ? 'bg-green-50 border-green-200 text-green-800 font-medium' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                                                        {i === q.correctAnswerIndex ? 
                                                            <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></div>
                                                            : <div className="w-2 h-2 rounded-full border border-gray-300 flex-shrink-0"></div>
                                                        }
                                                        <span>{opt}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            
                            {/* Append Hint at bottom */}
                            <div className="text-center pt-4 pb-8">
                                <p className="text-gray-500 text-sm mb-2">Faltou alguma questão do final do arquivo?</p>
                                <button 
                                    onClick={() => onExtract('append', 'end')}
                                    className="text-primary font-bold text-sm hover:underline flex items-center justify-center gap-1 mx-auto"
                                >
                                    <ClipboardListIcon className="w-4 h-4"/> Tentar Ler Apenas o Final (Anexar)
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 flex-grow flex flex-col justify-center">
                            <h3 className="text-lg font-semibold text-gray-700">Nenhuma Questão Encontrada</h3>
                            <p className="text-gray-500 mt-2 text-sm">A IA não conseguiu identificar questões estruturadas neste documento ou no trecho selecionado.</p>
                            <button onClick={() => onExtract('replace', 'all')} className="mt-4 text-primary font-bold text-sm hover:underline">Tentar Novamente (Arquivo Completo)</button>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};

export default QuestionBankView;
