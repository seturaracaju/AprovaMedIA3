
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Define Deno to avoid typescript errors if types are not loaded
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: any) => {
  // Tratamento de CORS (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Configurações e Validações
    console.log("Iniciando create-checkout v4 (Multi-Plan Support)...");
    
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!ASAAS_API_KEY) throw new Error('ASAAS_API_KEY não configurada no Supabase.')
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Variáveis do Supabase não configuradas.')

    const ASAAS_URL = 'https://www.asaas.com/api/v3' 

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    // 2. Ler dados do corpo da requisição
    let body;
    try {
        body = await req.json();
    } catch (e) {
        throw new Error('Corpo da requisição inválido (JSON esperado).');
    }
    
    const { userId, email, name, cpfCnpj, planType } = body;

    if (!userId || !email || !cpfCnpj) {
      throw new Error('Dados do usuário incompletos (userId, email ou CPF obrigatórios).')
    }

    // Lógica de Planos
    let value = 39.90;
    let cycle = 'MONTHLY';
    let description = 'Assinatura AprovaMed IA - Plano Mensal';

    if (planType === 'semiannual') {
        value = 199.00;
        cycle = 'SEMIANNUALLY';
        description = 'Assinatura AprovaMed IA - Plano Semestral';
    } else if (planType === 'annual') {
        value = 357.00;
        cycle = 'ANNUALLY';
        description = 'Assinatura AprovaMed IA - Plano Anual';
    } else {
        // Default Monthly
        value = 39.90;
        cycle = 'MONTHLY';
        description = 'Assinatura AprovaMed IA - Plano Mensal';
    }

    console.log(`Configurando plano: ${planType || 'default(monthly)'} | Valor: ${value} | Ciclo: ${cycle}`);

    // --- Helper Functions ---

    // Busca cliente no Asaas por CPF
    const getCustomerByCpf = async (cpf: string) => {
        const response = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${cpf}`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.data && data.data.length > 0 ? data.data[0] : null;
    };

    // Busca cliente no Asaas por Email
    const getCustomerByEmail = async (emailStr: string) => {
        const response = await fetch(`${ASAAS_URL}/customers?email=${emailStr}`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.data && data.data.length > 0 ? data.data[0] : null;
    };

    // Tenta atualizar um cliente. Retorna status.
    const updateAsaasCustomer = async (id: string, cpf: string) => {
        const response = await fetch(`${ASAAS_URL}/customers/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY
            },
            body: JSON.stringify({ cpfCnpj: cpf })
        });
        
        const json = await response.json();

        if (!response.ok) {
            if (response.status === 404) return { success: false, error: 'NOT_FOUND' };
            if (json.errors && json.errors[0].code === 'CUSTOMER_CPF_CNPJ_ALREADY_EXISTS') {
                return { success: false, error: 'CPF_EXISTS' };
            }
            const errDesc = json.errors ? json.errors[0].description : response.statusText;
            throw new Error(`Erro Asaas (Atualização): ${errDesc}`);
        }
        return { success: true };
    };

    const createAsaasCustomer = async () => {
        const response = await fetch(`${ASAAS_URL}/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY
            },
            body: JSON.stringify({
                name: name,
                email: email,
                cpfCnpj: cpfCnpj,
                notificationDisabled: false
            })
        });

        if (!response.ok) {
            const json = await response.json();
            if (json.errors && json.errors[0].code === 'CUSTOMER_CPF_CNPJ_ALREADY_EXISTS') {
                 const existing = await getCustomerByCpf(cpfCnpj);
                 if (existing) return existing.id;
            }
            const errDesc = json.errors ? json.errors[0].description : response.statusText;
            throw new Error(`Erro ao criar cliente: ${errDesc}`);
        }
        
        const data = await response.json();
        return data.id;
    };

    // --- Core Logic ---

    // 3. Buscar ID do DB
    const { data: studentData } = await supabase
      .from('students')
      .select('asaas_customer_id')
      .eq('user_id', userId)
      .single();

    let currentAsaasId = studentData?.asaas_customer_id;
    let finalCustomerId = null;

    // 4. Tentar validar/atualizar o ID do DB
    if (currentAsaasId) {
        const result = await updateAsaasCustomer(currentAsaasId, cpfCnpj);
        if (result.success) {
            finalCustomerId = currentAsaasId;
        } else if (result.error === 'CPF_EXISTS') {
            const existing = await getCustomerByCpf(cpfCnpj);
            if (existing) finalCustomerId = existing.id;
        }
    }

    // 5. Se não resolveu, buscar por Email
    if (!finalCustomerId) {
        const existingByEmail = await getCustomerByEmail(email);
        if (existingByEmail) {
            const result = await updateAsaasCustomer(existingByEmail.id, cpfCnpj);
            if (result.success) {
                finalCustomerId = existingByEmail.id;
            } else if (result.error === 'CPF_EXISTS') {
                const existingByCpf = await getCustomerByCpf(cpfCnpj);
                if (existingByCpf) finalCustomerId = existingByCpf.id;
            }
        }
    }

    // 6. Se ainda não resolveu, buscar diretamente pelo CPF
    if (!finalCustomerId) {
        const existingByCpf = await getCustomerByCpf(cpfCnpj);
        if (existingByCpf) {
            finalCustomerId = existingByCpf.id;
        }
    }

    // 7. Se nada funcionou, criar novo
    if (!finalCustomerId) {
        finalCustomerId = await createAsaasCustomer();
    }

    // 8. Atualizar DB se o ID mudou ou foi criado agora
    if (finalCustomerId && finalCustomerId !== currentAsaasId) {
        await supabase
            .from('students')
            .update({ asaas_customer_id: finalCustomerId })
            .eq('user_id', userId);
    }

    // 9. Criar Assinatura com o valor e ciclo corretos
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

    const subscriptionResponse = await fetch(`${ASAAS_URL}/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY
        },
        body: JSON.stringify({
          customer: finalCustomerId,
          billingType: 'UNDEFINED', 
          value: value,
          nextDueDate: nextDueDateStr, 
          cycle: cycle,
          description: description
        })
    })

    if (!subscriptionResponse.ok) {
         const errJson = await subscriptionResponse.json();
         const errDesc = errJson.errors ? errJson.errors[0].description : subscriptionResponse.statusText;
         console.error("Erro Asaas Subscription:", errDesc);
         throw new Error(`Erro ao criar assinatura no Asaas: ${errDesc}`);
    }

    const subscriptionData = await subscriptionResponse.json()

    // 10. Obter Link de Pagamento
    await new Promise(resolve => setTimeout(resolve, 1500)); 

    const chargesResponse = await fetch(`${ASAAS_URL}/payments?subscription=${subscriptionData.id}`, {
        headers: { 'access_token': ASAAS_API_KEY }
    })
    const chargesData = await chargesResponse.json()
    
    if (chargesData.data && chargesData.data.length > 0) {
        return new Response(
            JSON.stringify({ paymentUrl: chargesData.data[0].invoiceUrl }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } else {
        return new Response(
            JSON.stringify({ error: "A cobrança está sendo processada. Aguarde alguns instantes e tente novamente." }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    }

  } catch (error: any) {
    console.error("Erro Fatal Create-Checkout:", error.message || error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno no servidor." }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
