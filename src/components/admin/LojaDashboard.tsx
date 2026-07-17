"use client";

import { useState, useEffect } from "react";
import { ShoppingBag, Search, Plus, Filter, PackageOpen, Edit2, Trash2, X, Save, UploadCloud, Users, Loader2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

export default function LojaDashboard() {
  const [activeTab, setActiveTab] = useState<"estoque" | "vendas">("estoque");
  const [searchTerm, setSearchTerm] = useState("");
  
  const [products, setProducts] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal de Produto
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    if (activeTab === "estoque") {
      const res = await fetch('/api/admin/produtos');
      const data = await res.json();
      if (Array.isArray(data)) setProducts(data);
    } else {
      const { data } = await supabase.from('pedidos_loja')
        .select('*, produtos(name, image, category), clients(full_name, email, phone)')
        .order('created_at', { ascending: false });
      if (data) setSales(data);
    }
    setIsLoading(false);
  };

  const formatCurrency = (val: number) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredSales = sales.filter(s => 
    s.clients?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.produtos?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteProduct = async (id: string) => {
    if(window.confirm("Deseja realmente excluir este produto?")) {
      const res = await fetch(`/api/admin/produtos?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.code === '23503'
          ? "Este produto já possui vendas registradas. Zere o estoque em vez de excluir."
          : data.error;
        alert("Erro ao excluir: " + msg);
        return;
      }
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const handleEditProduct = (product: any) => {
    setEditingProduct({ ...product });
    setIsModalOpen(true);
  };

  const handleAddNewProduct = () => {
    setEditingProduct({
      name: "",
      category: "Equipamentos",
      price: 0,
      stock: 1,
      image: "",
      type: 'venda'
    });
    setIsModalOpen(true);
  };

  const saveProduct = async () => {
    if (!editingProduct?.name || editingProduct.price <= 0) return alert("Preencha nome e preço.");
    setIsSaving(true);
    
    try {
      const payload = {
        id: editingProduct.id,
        name: editingProduct.name,
        category: editingProduct.category,
        price: editingProduct.price,
        stock: editingProduct.stock,
        image: editingProduct.image || ''
      };

      const method = editingProduct.id ? 'PUT' : 'POST';
      const res = await fetch('/api/admin/produtos', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');

      await fetchData();
      setIsModalOpen(false);
      setEditingProduct(null);
    } catch (e: any) {
      alert("Erro ao salvar produto: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingImage(true);
    try {
      // Upload via API do servidor (evita problema de CORS com S3 presigned URL)
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/admin/upload-produto-image', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha no upload');
      
      setEditingProduct((prev: any) => ({ ...prev, image: data.url }));
    } catch (err: any) {
      alert("Erro no upload da imagem: " + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const updateSaleStatus = async (id: string, novoStatus: string) => {
    await supabase.from('pedidos_loja').update({ status_pagamento: novoStatus }).eq('id', id);
    setSales(sales.map(s => s.id === id ? { ...s, status_pagamento: novoStatus } : s));
  };

  return (
    <div className="space-y-6">
      {/* Abas Superiores */}
      <div className="flex gap-4 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('estoque')}
          className={`pb-4 px-2 font-bold text-sm transition-colors border-b-2 ${activeTab === 'estoque' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          <div className="flex items-center gap-2"><PackageOpen className="w-4 h-4"/> Estoque e Produtos</div>
        </button>
        <button 
          onClick={() => setActiveTab('vendas')}
          className={`pb-4 px-2 font-bold text-sm transition-colors border-b-2 ${activeTab === 'vendas' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          <div className="flex items-center gap-2"><ShoppingBag className="w-4 h-4"/> Histórico de Vendas</div>
        </button>
      </div>

      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 min-h-[60vh]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              {activeTab === 'estoque' ? 'Gestão de Estoque' : 'Pedidos Realizados'}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {activeTab === 'estoque' ? 'Gerencie os itens disponíveis na loja do app.' : 'Acompanhe as vendas, pagamentos e métodos de entrega.'}
            </p>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder={activeTab === 'estoque' ? "Buscar produto..." : "Buscar cliente..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {activeTab === 'estoque' && (
              <button onClick={handleAddNewProduct} className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 px-4 rounded-xl shadow-md transition-colors shrink-0 flex items-center gap-2 font-bold text-sm">
                <Plus className="w-5 h-5" /> Novo Produto
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
        ) : activeTab === 'estoque' ? (
          // ABA DE ESTOQUE
          filteredProducts.length === 0 ? (
            <div className="text-center py-20 text-gray-500">Nenhum produto encontrado.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product, index) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                  key={product.id} 
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col"
                >
                  <div className="h-48 bg-gray-50 relative overflow-hidden flex items-center justify-center">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <PackageOpen className="w-12 h-12 text-gray-300" />
                    )}
                    {product.stock <= 0 && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
                        <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">ESGOTADO</span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1 transition-opacity z-10">
                      <button onClick={() => handleEditProduct(product)} className="w-8 h-8 bg-white/90 text-blue-600 rounded-lg flex items-center justify-center shadow-sm hover:bg-white pointer-events-auto">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteProduct(product.id)} className="w-8 h-8 bg-white/90 text-red-600 rounded-lg flex items-center justify-center shadow-sm hover:bg-white pointer-events-auto">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-1">{product.category}</span>
                    <h3 className="font-bold text-gray-900 text-sm leading-tight flex-1 mb-2">{product.name}</h3>
                    
                    <div className="flex items-end justify-between mt-auto">
                      <div>
                        <p className="font-black text-lg text-gray-900">{formatCurrency(product.price)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-medium">Estoque</p>
                        <p className={`font-bold text-sm ${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>{product.stock || 0} un</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : (
          // ABA DE VENDAS
          filteredSales.length === 0 ? (
            <div className="text-center py-20 text-gray-500">Nenhuma venda registrada.</div>
          ) : (
            <div className="space-y-4">
              {filteredSales.map((sale, index) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}
                  key={sale.id}
                  className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col md:flex-row gap-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4 md:w-1/3">
                    <div className="w-16 h-16 bg-gray-50 rounded-xl overflow-hidden shrink-0">
                      {sale.produtos?.image ? (
                        <img src={sale.produtos.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-6 h-6 text-gray-300"/></div>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(sale.created_at).toLocaleDateString()}</p>
                      <h4 className="font-bold text-sm text-gray-900 leading-tight">{sale.produtos?.name || 'Produto Removido'}</h4>
                      <p className="text-blue-600 font-black">{formatCurrency(sale.valor_total)}</p>
                    </div>
                  </div>

                  <div className="md:w-1/3 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                    <h5 className="text-[10px] text-gray-400 font-bold uppercase mb-2 flex items-center gap-1"><Users className="w-3 h-3"/> Comprador</h5>
                    <p className="font-bold text-sm text-gray-800">{sale.clients?.full_name}</p>
                    <p className="text-xs text-gray-500">{sale.clients?.email}</p>
                    <p className="text-xs text-gray-500 mt-1">{sale.clients?.phone}</p>
                  </div>

                  <div className="md:w-1/3 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 flex flex-col justify-between">
                    <div>
                      <h5 className="text-[10px] text-gray-400 font-bold uppercase mb-1">Entrega / Retirada</h5>
                      <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold uppercase mb-1">
                        {sale.forma_entrega?.replace('_', ' ') || 'Não informada'}
                      </span>
                      {sale.delivery_info && (
                        <p className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded-lg mt-1 border border-gray-100">{sale.delivery_info}</p>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        {sale.status_pagamento === 'pago' ? (
                          <span className="text-green-600 bg-green-50 px-2 py-1 rounded-lg text-xs font-black flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3"/> PAGO ({sale.metodo_pagamento})
                          </span>
                        ) : (
                          <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded-lg text-xs font-black">
                            PENDENTE ({sale.metodo_pagamento})
                          </span>
                        )}
                      </div>
                      
                      {sale.status_pagamento === 'pendente' && (
                        <button 
                          onClick={() => updateSaleStatus(sale.id, 'pago')}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 underline"
                        >
                          Marcar Pago
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Modal de Edição de Produto */}
      <AnimatePresence>
        {isModalOpen && editingProduct && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}
            >
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-black text-gray-900 text-lg">
                  {editingProduct.id ? 'Editar Equipamento' : 'Novo Equipamento'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 bg-gray-100 rounded-2xl overflow-hidden relative border border-gray-200 flex shrink-0">
                    {uploadingImage ? (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50"><Loader2 className="w-6 h-6 animate-spin text-blue-600"/></div>
                    ) : editingProduct.image ? (
                      <img src={editingProduct.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><PackageOpen className="w-8 h-8 text-gray-300"/></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Foto do Produto</label>
                    <input type="file" id="prod-img" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    <label htmlFor="prod-img" className="bg-white border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-500 hover:text-blue-600 cursor-pointer px-4 py-2.5 rounded-xl text-sm font-bold transition-all inline-flex items-center gap-2">
                      <UploadCloud className="w-4 h-4"/> Alterar Imagem
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nome do Equipamento</label>
                  <input 
                    type="text" 
                    value={editingProduct.name}
                    onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Categoria</label>
                    <select 
                      value={editingProduct.category}
                      onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="Equipamentos">Equipamentos</option>
                      <option value="Calçados">Calçados</option>
                      <option value="Acessórios">Acessórios</option>
                      <option value="Vestuário">Vestuário</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Preço</label>
                    <input 
                      type="number" 
                      value={editingProduct.price}
                      onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Qtd. Estoque</label>
                  <input 
                    type="number" 
                    value={editingProduct.stock}
                    onChange={e => setEditingProduct({...editingProduct, stock: Number(e.target.value)})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <button 
                  onClick={saveProduct} 
                  disabled={isSaving}
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5" />} 
                  {isSaving ? 'Salvando...' : 'Salvar Equipamento'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
