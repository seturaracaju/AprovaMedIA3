
import React, { useState, useEffect } from 'react';
import { MarketplaceItem, QuestionSet } from '../types';
import * as marketplaceService from '../services/marketplaceService';
import * as questionBankService from '../services/questionBankService';
import * as storageService from '../services/storageService';
import { ShoppingBagIcon, PlusCircleIcon, TrashIcon, TagIcon, XIcon, FileTextIcon, UploadCloudIcon, CreditCardIcon, SaveIcon, EditIcon } from './IconComponents';

const MarketplaceManagementPage: React.FC = () => {
    const [items, setItems] = useState<MarketplaceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    
    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState<number>(0);
    const [category, setCategory] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [selectedContentId, setSelectedContentId] = useState('');
    const [paymentLink, setPaymentLink] = useState('');
    const [pdfUrl, setPdfUrl] = useState('');
    
    const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [availableContent, setAvailableContent] = useState<QuestionSet[]>([]);

    const fetchData = async () => {
        setLoading(true);
        const [marketItems, questionBank] = await Promise.all([
            marketplaceService.getMarketplaceItems(),
            questionBankService.getQuestionBank()
        ]);
        setItems(marketItems);
        setAvailableContent(Object.values(questionBank));
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenEdit = (item: MarketplaceItem) => {
        setEditingItemId(item.id);
        setTitle(item.title);
        setDescription(item.description);
        setPrice(item.price);
        setCategory(item.category);
        setImageUrl(item.image_url || '');
        setSelectedContentId(item.content_id);
        setPaymentLink((item as any).payment_link || '');
        setPdfUrl((item as any).pdf_url || '');
        setSelectedPdfFile(null);
        setIsModalOpen(true);
    };

    const handleCreateOrUpdate = async () => {
        if (!title || !description) return alert("Preencha o título e descrição");
        
        setIsSaving(true);
        try {
            let finalPdfUrl = pdfUrl;

            if (selectedPdfFile) {
                const uploadedUrl = await storageService.uploadMaterial(selectedPdfFile);
                if (uploadedUrl) {
                    finalPdfUrl = uploadedUrl;
                } else {
                    throw new Error("Falha ao subir arquivo PDF.");
                }
            }

            const itemPayload = {
                title,
                description,
                price: Number(price),
                category: category || 'Geral',
                image_url: imageUrl,
                content_id: selectedContentId || '00000000-0000-0000-0000-000000000000',
                content_type: 'question_set' as const,
                pdf_url: finalPdfUrl,
                payment_link: paymentLink
            };

            let success = false;
            if (editingItemId) {
                // Para simplificar, usamos a mesma lógica de add mas você pode implementar um updateService se preferir
                // Aqui vamos deletar e criar se for apenas marketplace, ou atualizar se o service permitir.
                // Como marketplaceService.addMarketplaceItem usa insert, vamos implementar o update localmente via Supabase se necessário.
                // Por agora, trataremos como novo registro ou implementação de update.
                const { error } = await (marketplaceService as any).supabase
                    .from('marketplace_items')
                    .update(itemPayload)
                    .eq('id', editingItemId);
                success = !error;
            } else {
                const result = await marketplaceService.addMarketplaceItem(itemPayload as any);
                success = !!result;
            }

            if (success) {
                setIsModalOpen(false);
                resetForm();
                fetchData();
            } else {
                alert("Erro ao salvar produto.");
            }
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Tem certeza que deseja remover este item da loja?")) {
            await marketplaceService.deleteMarketplaceItem(id);
            fetchData();
        }
    };

    const resetForm = () => {
        setEditingItemId(null);
        setTitle('');
        setDescription('');
        setPrice(0);
        setCategory('');
        setImageUrl('');
        setSelectedContentId('');
        setPaymentLink('');
        setPdfUrl('');
        setSelectedPdfFile(null);
    };

    return (
        <div className="h-full w-full flex flex-col bg-gray-50 overflow-y-auto">
            <header className="p-6 border-b border-gray-200 bg-white flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <ShoppingBagIcon className="w-8 h-8 text-primary" />
                        Gestão da Loja
                    </h1>
                    <p className="text-gray-500 mt-1">Gerencie materiais e links de pagamento.</p>
                </div>
                <button 
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark flex items-center gap-2"
                >
                    <PlusCircleIcon className="w-5 h-5" /> Adicionar Produto
                </button>
            </header>

            <main className="flex-grow p-6">
                {loading ? (
                    <div className="flex justify-center items-center h-64"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
                ) : items.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {items.map(item => (
                            <div key={item.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col group relative">
                                {/* Botões de Ação no Card */}
                                <div className="absolute top-2 right-2 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleOpenEdit(item)}
                                        className="p-2 bg-white text-primary rounded-full shadow-lg hover:bg-primary hover:text-white transition-all"
                                        title="Editar Produto"
                                    >
                                        <EditIcon className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(item.id)}
                                        className="p-2 bg-white text-red-600 rounded-full shadow-lg hover:bg-red-600 hover:text-white transition-all"
                                        title="Excluir Produto"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="h-40 bg-gray-200 relative">
                                    {item.image_url ? (
                                        <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                            <TagIcon className="w-12 h-12 text-gray-300" />
                                        </div>
                                    )}
                                    <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-bold">
                                        {item.category}
                                    </div>
                                    {(item as any).pdf_url && (
                                        <div className="absolute top-2 left-2 bg-primary text-white p-1.5 rounded-lg shadow-lg">
                                            <FileTextIcon className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>
                                <div className="p-5 flex-grow flex flex-col">
                                    <h3 className="text-lg font-bold text-gray-800 mb-1">{item.title}</h3>
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-grow">{item.description}</p>
                                    
                                    <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                                        <span className="font-bold text-lg text-primary">
                                            {item.price > 0 ? `R$ ${item.price.toFixed(2)}` : 'Grátis'}
                                        </span>
                                        <div className="flex gap-2">
                                            {(item as any).payment_link && <CreditCardIcon className="w-4 h-4 text-green-500" title="Link de Pagamento Ativo" />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-gray-500">
                        <ShoppingBagIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <h2 className="text-xl font-semibold">A loja está vazia</h2>
                        <p className="mt-2">Adicione o primeiro produto para os alunos.</p>
                    </div>
                )}
            </main>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[95vh] flex flex-col animate-scaleUp">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingItemId ? 'Editar Produto' : 'Novo Produto / Material'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><XIcon className="w-5 h-5 text-gray-500"/></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título do Produto</label>
                                <input 
                                    type="text" 
                                    value={title} 
                                    onChange={e => setTitle(e.target.value)} 
                                    className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-primary outline-none" 
                                    placeholder="Ex: Apostila de Pediatria 2024"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
                                <textarea 
                                    value={description} 
                                    onChange={e => setDescription(e.target.value)} 
                                    className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-primary outline-none" 
                                    rows={3} 
                                    placeholder="Descreva o que o aluno está adquirindo..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço (R$) <span className="text-gray-400 normal-case font-normal">(0 = Grátis)</span></label>
                                    <input 
                                        type="number" 
                                        value={price} 
                                        onChange={e => setPrice(Number(e.target.value))} 
                                        className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-primary outline-none font-bold text-primary" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label>
                                    <input 
                                        type="text" 
                                        value={category} 
                                        onChange={e => setCategory(e.target.value)} 
                                        placeholder="Ex: Apostilas" 
                                        className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-primary outline-none placeholder:text-gray-400" 
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Link de Pagamento (Asaas/Outros)</label>
                                <div className="flex gap-2">
                                    <div className="bg-gray-100 p-3 rounded-lg text-gray-400"><CreditCardIcon className="w-5 h-5"/></div>
                                    <input 
                                        type="text" 
                                        value={paymentLink} 
                                        onChange={e => setPaymentLink(e.target.value)} 
                                        placeholder="https://asaas.com/c/..." 
                                        className="flex-grow p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-primary outline-none text-sm" 
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Material (PDF para Download)</label>
                                {pdfUrl && !selectedPdfFile && (
                                    <div className="mb-2 p-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-700 flex items-center gap-2">
                                        <FileTextIcon className="w-4 h-4"/> Arquivo atual já vinculado. Suba outro para substituir.
                                    </div>
                                )}
                                <label className="relative flex flex-col items-center justify-center w-full p-4 border-2 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors border-gray-300 hover:border-primary/50">
                                    <UploadCloudIcon className="w-8 h-8 text-gray-400 mb-2" />
                                    <span className="text-sm font-semibold text-gray-600 text-center px-2 truncate w-full">
                                        {selectedPdfFile ? selectedPdfFile.name : 'Selecionar novo arquivo PDF'}
                                    </span>
                                    <input type="file" className="hidden" accept=".pdf" onChange={e => e.target.files && setSelectedPdfFile(e.target.files[0])} />
                                </label>
                            </div>

                            <div className="grid grid-cols-1 gap-4 pt-2 border-t border-gray-100">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">URL da Capa (Opcional)</label>
                                    <input 
                                        type="text" 
                                        value={imageUrl} 
                                        onChange={e => setImageUrl(e.target.value)} 
                                        className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs text-gray-800 focus:ring-2 focus:ring-primary outline-none" 
                                        placeholder="https://exemplo.com/capa.jpg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vincular a Assunto Existente (Opcional)</label>
                                    <select 
                                        value={selectedContentId} 
                                        onChange={e => setSelectedContentId(e.target.value)} 
                                        className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs text-gray-800 focus:ring-2 focus:ring-primary outline-none"
                                    >
                                        <option value="">Nenhum assunto vinculado</option>
                                        {availableContent.map(c => (
                                            <option key={c.id} value={c.id}>{c.subjectName}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-gray-600 font-semibold hover:bg-gray-200 rounded-lg transition-colors">Cancelar</button>
                            <button 
                                onClick={handleCreateOrUpdate} 
                                disabled={isSaving}
                                className="px-8 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark transition-all disabled:bg-gray-300 flex items-center gap-2 shadow-lg shadow-primary/20"
                            >
                                {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <SaveIcon className="w-5 h-5"/>}
                                {isSaving ? 'Salvando...' : editingItemId ? 'Atualizar Produto' : 'Salvar Produto'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarketplaceManagementPage;
