
import React, { useState, useEffect } from 'react';
import { Student, MarketplaceItem } from '../../types';
import * as marketplaceService from '../../services/marketplaceService';
import { ShoppingBagIcon, TagIcon, CheckCircleIcon, DownloadIcon, CreditCardIcon, FileTextIcon } from '../IconComponents';
import { supabase } from '../../services/supabaseClient';

interface StudentMarketplacePageProps {
    student: Student;
}

const StudentMarketplacePage: React.FC<StudentMarketplacePageProps> = ({ student }) => {
    const [items, setItems] = useState<MarketplaceItem[]>([]);
    const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [marketItems, purchases] = await Promise.all([
                marketplaceService.getMarketplaceItems(),
                supabase.from('student_purchases').select('item_id').eq('student_id', student.id)
            ]);
            
            setItems(marketItems);
            setPurchasedIds(new Set(purchases.data?.map(p => p.item_id) || []));
            setLoading(false);
        };
        fetchData();
    }, [student.id]);

    const handleAction = async (item: MarketplaceItem) => {
        const isFree = item.price === 0;
        const isAlreadyPurchased = purchasedIds.has(item.id);
        const hasPdf = (item as any).pdf_url;

        // Se é grátis e tem PDF, ou se já comprou e tem PDF -> Download
        if ((isFree || isAlreadyPurchased) && hasPdf) {
            window.open((item as any).pdf_url, '_blank');
            // Se for o primeiro "download" de um item grátis, registramos a posse
            if (isFree && !isAlreadyPurchased) {
                await marketplaceService.purchaseItem(student.id, item.id);
                setPurchasedIds(prev => new Set(prev).add(item.id));
            }
            return;
        }

        // Se é pago e não comprou -> Fluxo de Aquisição
        if (!isAlreadyPurchased) {
            if ((item as any).payment_link) {
                // Abre gateway externo configurado pelo professor
                window.open((item as any).payment_link, '_blank');
            } else {
                // Fluxo padrão Asaas interno (se configurado na Edge Function)
                setIsProcessing(item.id);
                const success = await marketplaceService.purchaseItem(student.id, item.id);
                if (success) {
                    setPurchasedIds(prev => new Set(prev).add(item.id));
                    alert("Aquisição realizada com sucesso! O conteúdo já está disponível.");
                }
                setIsProcessing(null);
            }
        }
    };

    return (
        <div className="h-full w-full flex flex-col bg-gray-50 overflow-y-auto">
            <header className="p-6 border-b border-gray-200 bg-white shadow-sm">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <ShoppingBagIcon className="w-8 h-8 text-primary" />
                    Loja de Materiais
                </h1>
                <p className="text-gray-500 mt-1">Adquira apostilas, PDFs e conteúdos exclusivos.</p>
            </header>

            <main className="flex-grow p-6">
                {loading ? (
                    <div className="flex justify-center items-center h-64"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
                ) : items.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {items.map(item => {
                            const isFree = item.price === 0;
                            const isPurchased = purchasedIds.has(item.id);
                            const hasPdf = (item as any).pdf_url;
                            
                            return (
                                <div key={item.id} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden flex flex-col hover:shadow-xl transition-all group border-b-4 border-b-transparent hover:border-b-primary">
                                    <div className="h-44 bg-gray-100 relative">
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-blue-500/10">
                                                <TagIcon className="w-12 h-12 text-primary/30" />
                                            </div>
                                        )}
                                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-black text-gray-700 uppercase shadow-sm">
                                            {item.category}
                                        </div>
                                        {isPurchased && (
                                            <div className="absolute top-3 left-3 bg-green-500 text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-lg">
                                                <CheckCircleIcon className="w-3 h-3"/> ADQUIRIDO
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-6 flex-grow flex flex-col">
                                        <h3 className="text-xl font-bold text-gray-800 mb-2 leading-tight">{item.title}</h3>
                                        <p className="text-sm text-gray-500 mb-6 line-clamp-3 leading-relaxed">{item.description}</p>
                                        
                                        <div className="mt-auto flex items-center justify-between pt-5 border-t border-gray-100">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Investimento</span>
                                                <span className={`text-xl font-black ${isFree ? 'text-green-600' : 'text-primary'}`}>
                                                    {isFree ? 'GRÁTIS' : `R$ ${item.price.toFixed(2)}`}
                                                </span>
                                            </div>

                                            <button
                                                onClick={() => handleAction(item)}
                                                disabled={isProcessing === item.id}
                                                className={`px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95
                                                    ${(isFree || isPurchased) 
                                                        ? (hasPdf ? 'bg-primary text-white hover:bg-primary-dark shadow-primary/20' : 'bg-gray-100 text-gray-400 cursor-default') 
                                                        : 'bg-gray-900 text-white hover:bg-black shadow-gray-900/20'
                                                    }`}
                                            >
                                                {isProcessing === item.id ? (
                                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                ) : (isFree || isPurchased) ? (
                                                    hasPdf ? <><DownloadIcon className="w-5 h-5"/> Baixar PDF</> : 'Em Breve'
                                                ) : (
                                                    <><CreditCardIcon className="w-5 h-5"/> {(item as any).payment_link ? 'Adquirir' : 'Comprar'}</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-gray-300">
                        <ShoppingBagIcon className="w-20 h-20 mx-auto mb-4 text-gray-200" />
                        <h2 className="text-2xl font-bold text-gray-400 tracking-tight">A vitrine está sendo organizada</h2>
                        <p className="mt-2 text-gray-400 max-w-xs mx-auto">Em breve novos materiais exclusivos estarão disponíveis aqui.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default StudentMarketplacePage;
