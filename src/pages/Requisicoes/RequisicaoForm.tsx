import React, { useState } from 'react';

// Exemplo de props esperadas
// clientes, fornecedores, viaturas, stockItems, onSubmit, etc
export default function RequisicaoForm({
  clientes = [],
  fornecedores = [],
  viaturas = [],
  stockItems = [],
  onSubmit,
}) {
  // Estados principais
  const [tipoRequisicao, setTipoRequisicao] = useState('OFICINA');
  const [clienteId, setClienteId] = useState('');
  const [fornecedorId, setFornecedorId] = useState('');
  const [viaturaId, setViaturaId] = useState('');
  const [kmViatura, setKmViatura] = useState('');
  const [tipoIntervencao, setTipoIntervencao] = useState('');
  const [prioridade, setPrioridade] = useState('Normal');
  const [estado, setEstado] = useState('Criada');
  const [obs, setObs] = useState('');
  const [items, setItems] = useState([]);
  const [anexos, setAnexos] = useState([]);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showFornecedorModal, setShowFornecedorModal] = useState(false);

  // Handlers para anexos
  const handleUploadAnexo = (e) => {
    const files = Array.from(e.target.files);
    setAnexos([...anexos, ...files]);
  };
  const handleRemoveAnexo = (idx) => {
    setAnexos(anexos.filter((_, i) => i !== idx));
  };

  // Handler para adicionar item
  const handleAddItem = (item) => {
    setItems([...items, item]);
  };
  const handleRemoveItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  // Handler de submit
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit && onSubmit({
      tipoRequisicao,
      clienteId,
      fornecedorId,
      viaturaId: tipoRequisicao === 'VIATURA' ? viaturaId : undefined,
      kmViatura: tipoRequisicao === 'VIATURA' ? kmViatura : undefined,
      tipoIntervencao: tipoRequisicao === 'VIATURA' ? tipoIntervencao : undefined,
      prioridade,
      estado,
      obs,
      items,
      anexos,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Tipo de Requisição */}
      <label>Tipo de Requisição</label>
      <select value={tipoRequisicao} onChange={e => setTipoRequisicao(e.target.value)}>
        <option value="OFICINA">Oficina</option>
        <option value="STOCK">Stock</option>
        <option value="VIATURA">Viatura</option>
      </select>

      {/* Cliente (opcional) */}
      <label>Cliente</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={clienteId} onChange={e => setClienteId(e.target.value)}>
          <option value="">Nenhum</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <button type="button" onClick={() => setShowClienteModal(true)}>+ Novo cliente</button>
      </div>

      {/* Fornecedor (opcional) */}
      <label>Fornecedor</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)}>
          <option value="">Nenhum</option>
          {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
        <button type="button" onClick={() => setShowFornecedorModal(true)}>+ Novo fornecedor</button>
      </div>

      {/* Campos específicos para VIATURA */}
      {tipoRequisicao === 'VIATURA' && (
        <>
          <label>Viatura</label>
          <select value={viaturaId} onChange={e => setViaturaId(e.target.value)}>
            <option value="">Selecione</option>
            {viaturas.map(v => <option key={v.id} value={v.id}>{v.matricula} - {v.marca} {v.modelo}</option>)}
          </select>
          <label>KM Viatura</label>
          <input type="number" value={kmViatura} onChange={e => setKmViatura(e.target.value)} />
          <label>Tipo de Intervenção</label>
          <input type="text" value={tipoIntervencao} onChange={e => setTipoIntervencao(e.target.value)} />
        </>
      )}

      {/* Prioridade */}
      <label>Prioridade</label>
      <select value={prioridade} onChange={e => setPrioridade(e.target.value)}>
        <option value="Baixa">Baixa</option>
        <option value="Normal">Normal</option>
        <option value="Urgente">Urgente</option>
        <option value="Imobilização">Imobilização</option>
      </select>

      {/* Estado */}
      <label>Estado</label>
      <select value={estado} onChange={e => setEstado(e.target.value)}>
        <option value="Criada">Criada</option>
        <option value="Aprovada">Aprovada</option>
        <option value="Em preparação">Em preparação</option>
        <option value="Em execução">Em execução</option>
        <option value="Concluída">Concluída</option>
        <option value="Cancelada">Cancelada</option>
      </select>

      {/* Itens da Requisição */}
      <ItensRequisicaoComponent
        items={items}
        setItems={setItems}
        stockItems={stockItems}
      />

      {/* Anexos Técnicos */}
      <label>Anexos Técnicos</label>
      <input type="file" multiple onChange={handleUploadAnexo} />
      <ul>
        {anexos.map((file, idx) => (
          <li key={idx}>{file.name} <button type="button" onClick={() => handleRemoveAnexo(idx)}>Remover</button></li>
        ))}
      </ul>

      {/* Observações */}
      <label>Observações</label>
      <textarea value={obs} onChange={e => setObs(e.target.value)} />

      <button type="submit">Salvar</button>

      {/* Modais de criação rápida (exemplo simplificado) */}
      {showClienteModal && (
        <ModalNovoCliente onClose={() => setShowClienteModal(false)} onSave={novoCliente => {
          setShowClienteModal(false);
          // Atualizar lista de clientes no parent
        }} />
      )}
      {showFornecedorModal && (
        <ModalNovoFornecedor onClose={() => setShowFornecedorModal(false)} onSave={novoFornecedor => {
          setShowFornecedorModal(false);
          // Atualizar lista de fornecedores no parent
        }} />
      )}
    </form>
  );
}

// Componentes auxiliares (placeholders)

function ItensRequisicaoComponent({ items, setItems, stockItems }) {
  const [itemNome, setItemNome] = React.useState('');
  const [quantidade, setQuantidade] = React.useState(1);
  const [stockItemId, setStockItemId] = React.useState('');
  const [custoEstimado, setCustoEstimado] = React.useState('');
  const [custoReal, setCustoReal] = React.useState('');

  const handleAdd = () => {
    if (!itemNome && !stockItemId) return;
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        item_nome: itemNome || (stockItems.find(s => s.id === stockItemId)?.nome || ''),
        quantidade,
        stock_item_id: stockItemId || null,
        custo_estimado: custoEstimado ? parseFloat(custoEstimado) : null,
        custo_real: custoReal ? parseFloat(custoReal) : null,
      }
    ]);
    setItemNome('');
    setQuantidade(1);
    setStockItemId('');
    setCustoEstimado('');
    setCustoReal('');
  };

  const handleRemove = idx => setItems(items.filter((_, i) => i !== idx));

  return (
    <div>
      <h4>Itens da Requisição</h4>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <select value={stockItemId} onChange={e => setStockItemId(e.target.value)}>
          <option value="">Item de stock (opcional)</option>
          {stockItems.map(s => (
            <option key={s.id} value={s.id}>{s.nome} (Disponível: {s.quantidade})</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Nome do item"
          value={itemNome}
          onChange={e => setItemNome(e.target.value)}
          disabled={!!stockItemId}
        />
        <input
          type="number"
          min={1}
          value={quantidade}
          onChange={e => setQuantidade(Number(e.target.value))}
          style={{ width: 60 }}
        />
        <input
          type="number"
          placeholder="Custo estimado"
          value={custoEstimado}
          onChange={e => setCustoEstimado(e.target.value)}
          style={{ width: 100 }}
        />
        <input
          type="number"
          placeholder="Custo real"
          value={custoReal}
          onChange={e => setCustoReal(e.target.value)}
          style={{ width: 100 }}
        />
        <button type="button" onClick={handleAdd}>Adicionar</button>
      </div>
      <ul>
        {items.map((item, idx) => (
          <li key={item.id}>
            {item.item_nome} | Qtd: {item.quantidade} | Estimado: {item.custo_estimado ?? '-'} | Real: {item.custo_real ?? '-'}
            <button type="button" onClick={() => handleRemove(idx)}>Remover</button>
          </li>
        ))}
      </ul>
    </div>
  );
}


function ModalNovoCliente({ onClose, onSave }) {
  const [nome, setNome] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [nif, setNif] = React.useState('');
  const [morada, setMorada] = React.useState('');
  const [telefone, setTelefone] = React.useState('');
  const handleSubmit = e => {
    e.preventDefault();
    if (!nome) return alert('Nome obrigatório');
    onSave && onSave({ nome, email, nif, morada, telefone });
  };
  return (
    <div className="modal-bg">
      <div className="modal-content">
        <h3>Novo Cliente</h3>
        <form onSubmit={handleSubmit}>
          <label>Nome*</label>
          <input value={nome} onChange={e => setNome(e.target.value)} required />
          <label>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} />
          <label>NIF</label>
          <input value={nif} onChange={e => setNif(e.target.value)} />
          <label>Morada</label>
          <input value={morada} onChange={e => setMorada(e.target.value)} />
          <label>Telefone</label>
          <input value={telefone} onChange={e => setTelefone(e.target.value)} />
          <div style={{ marginTop: 12 }}>
            <button type="submit">Salvar</button>
            <button type="button" onClick={onClose} style={{ marginLeft: 8 }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalNovoFornecedor({ onClose, onSave }) {
  const [nome, setNome] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [nif, setNif] = React.useState('');
  const [morada, setMorada] = React.useState('');
  const [contacto, setContacto] = React.useState('');
  const handleSubmit = e => {
    e.preventDefault();
    if (!nome) return alert('Nome obrigatório');
    onSave && onSave({ nome, email, nif, morada, contacto });
  };
  return (
    <div className="modal-bg">
      <div className="modal-content">
        <h3>Novo Fornecedor</h3>
        <form onSubmit={handleSubmit}>
          <label>Nome*</label>
          <input value={nome} onChange={e => setNome(e.target.value)} required />
          <label>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} />
          <label>NIF</label>
          <input value={nif} onChange={e => setNif(e.target.value)} />
          <label>Morada</label>
          <input value={morada} onChange={e => setMorada(e.target.value)} />
          <label>Contacto</label>
          <input value={contacto} onChange={e => setContacto(e.target.value)} />
          <div style={{ marginTop: 12 }}>
            <button type="submit">Salvar</button>
            <button type="button" onClick={onClose} style={{ marginLeft: 8 }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
