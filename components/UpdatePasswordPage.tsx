import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

const UpdatePasswordPage: React.FC<{ onPasswordUpdated: () => void }> = ({ onPasswordUpdated }) => {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            
            setMessage('Senha atualizada com sucesso!');
            setTimeout(() => {
                onPasswordUpdated();
            }, 2000);
        } catch (err: any) {
            setError(err.error_description || err.message);
        } finally {
            setLoading(false);
        }
    };

    const logoUrl = "https://pub-872633efa2d545638be12ea86363c2ca.r2.dev/WhatsApp%20Image%202025-11-09%20at%2013.47.15%20(1).png";

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg">
                <img src={logoUrl} alt="AprovaMed IA Logo" className="w-full h-auto mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
                    Atualizar Senha
                </h2>
                <p className="text-center text-gray-500 mb-6 text-sm">
                    Digite sua nova senha abaixo.
                </p>

                {error && <p className="bg-red-100 text-red-700 p-3 rounded-md text-sm mb-4">{error}</p>}
                {message && <p className="bg-green-100 text-green-700 p-3 rounded-md text-sm mb-4">{message}</p>}

                <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <input 
                        type="password" 
                        placeholder="Nova Senha" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        required 
                        className="w-full px-4 py-3 border rounded-lg bg-white text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-primary focus:outline-none" 
                    />
                    <button 
                        type="submit" 
                        disabled={loading} 
                        className="w-full px-4 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark disabled:bg-gray-400"
                    >
                        {loading ? 'Atualizando...' : 'Atualizar Senha'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default UpdatePasswordPage;
