import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ptfgevdwcrwepkojrrnp.supabase.co';
const supabaseKey = 'sb_publishable_M0H58B0lOaESxkZpfFujZw_zbv7IaQF';

const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_TEMPLATE_NAME = '🏨 Escala Permanente — Hotel';

async function seed() {
    console.log('🔍 A verificar se o template padrão já existe...');

    // Check if tables exist first
    const { data: tableCheck, error: tableError } = await supabase
        .from('escala_templates')
        .select('id')
        .limit(1);

    if (tableError) {
        console.error('❌ A tabela escala_templates não existe ainda. Executa primeiro a migration SQL.');
        console.error(tableError.message);
        process.exit(1);
    }

    // Check if default template already exists
    const { data: existing } = await supabase
        .from('escala_templates')
        .select('id')
        .eq('nome', DEFAULT_TEMPLATE_NAME)
        .single();

    if (existing) {
        console.log('✅ Template padrão já existe! ID:', existing.id);
        return;
    }

    console.log('➕ A criar template padrão...');

    // Create the template
    const { data: template, error: tErr } = await supabase
        .from('escala_templates')
        .insert({ nome: DEFAULT_TEMPLATE_NAME })
        .select()
        .single();

    if (tErr) {
        console.error('❌ Erro ao criar template:', tErr.message);
        process.exit(1);
    }

    console.log('✅ Template criado! ID:', template.id);

    // Define the schedule items (typical hotel staff transport)
    const items = [
        { hora_entrada: '06:00', hora_saida: '14:00', passageiro: 'Rececionista Turno Manhã', local: 'Hotel' },
        { hora_entrada: '06:30', hora_saida: '14:30', passageiro: 'Cozinheiro Turno Manhã', local: 'Hotel' },
        { hora_entrada: '07:00', hora_saida: '15:00', passageiro: 'Empregado Mesa A', local: 'Hotel' },
        { hora_entrada: '07:00', hora_saida: '15:00', passageiro: 'Empregado Mesa B', local: 'Hotel' },
        { hora_entrada: '08:00', hora_saida: '16:00', passageiro: 'Animador A', local: 'Hotel' },
        { hora_entrada: '08:00', hora_saida: '16:00', passageiro: 'Animador B', local: 'Hotel' },
        { hora_entrada: '14:00', hora_saida: '22:00', passageiro: 'Rececionista Turno Tarde', local: 'Hotel' },
        { hora_entrada: '14:30', hora_saida: '22:30', passageiro: 'Cozinheiro Turno Tarde', local: 'Hotel' },
        { hora_entrada: '15:00', hora_saida: '23:00', passageiro: 'Empregado Mesa C', local: 'Hotel' },
        { hora_entrada: '15:00', hora_saida: '23:00', passageiro: 'Empregado Mesa D', local: 'Hotel' },
        { hora_entrada: '22:00', hora_saida: '06:00', passageiro: 'Segurança Turno Noite', local: 'Hotel' },
        { hora_entrada: '22:30', hora_saida: '06:30', passageiro: 'Rececionista Turno Noite', local: 'Hotel' },
    ].map(item => ({ ...item, template_id: template.id }));

    const { error: itemsErr } = await supabase
        .from('escala_template_items')
        .insert(items);

    if (itemsErr) {
        console.error('❌ Erro ao criar itens do template:', itemsErr.message);
        process.exit(1);
    }

    console.log(`✅ ${items.length} itens inseridos com sucesso!`);
    console.log('\n🎉 Template padrão pronto a usar na aplicação!');
}

seed();
