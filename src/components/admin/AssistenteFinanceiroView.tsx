"use client";

import React, { useState } from 'react';
import { TrendingUp, DollarSign, Sparkles, Percent, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Reserva {
  agenda_id: string;
  status_pagamento: string;
  valor_pago: number | string;
}

interface Custo {
  agenda_id: string;
  valor_custo: number | string;
}

interface Agenda {
  id: string;
  title: string;
  price: number;
  max_capacity: number;
}

interface Props {
  agenda: Agenda;
  reservas: Reserva[];
  custos: Custo[];
}

export default function AssistenteFinanceiroView({ agenda, reservas, custos }: Props) {
  // Configurações do Asaas e precificação
  const [taxaPercentual, setTaxaPercentual] = useState<number>(3.99); // Ex: Cartão de Crédito
  const [taxaFixa, setTaxaFixa] = useState<number>(0.39); // Ex: Taxa fixa por transação
  const [repassarTaxa, setRepassarTaxa] = useState<boolean>(false);
  const [metamargem, setMetamargem] = useState<number>(30); // Margem de lucro desejada %

  // Cálculos Básicos
  const reservasValidas = reservas.filter(r => r.agenda_id === agenda.id);
  const pagantes = reservasValidas.filter(r => r.status_pagamento === 'pago');
  const cortesias = reservasValidas.filter(r => r.status_pagamento === 'pendente');
  const ocupadas = reservasValidas.length; // Conta pendentes e pagos para lotação
  const vagasRestantes = Math.max(0, (agenda.max_capacity || 15) - ocupadas);

  const totalRev = pagantes.reduce((acc, r) => acc + Number(r.valor_pago || 0), 0);
  const totalCst = custos.filter(c => c.agenda_id === agenda.id).reduce((acc, c) => acc + Number(c.valor_custo || 0), 0);
  const netProfit = totalRev - totalCst;

  // Função para calcular o preço final necessário para obter uma receita líquida X
  const calcularPrecoParaReceita = (receitaDesejada: number) => {
    if (repassarTaxa) return receitaDesejada; // Se o cliente paga a taxa, eu recebo exato o que cobrei
    // Fórmula: Preço * (1 - taxa/100) - taxaFixa = Receita
    // Preço = (Receita + taxaFixa) / (1 - taxa/100)
    return (receitaDesejada + taxaFixa) / (1 - (taxaPercentual / 100));
  };

  // Função para formatar moeda
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm animate-fade-in-up">
      {/* HEADER E TOTAIS */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        <div className="flex-1">
          <h3 className="font-black text-gray-800 text-xl flex items-center gap-2 mb-1">
            <TrendingUp className="w-6 h-6 text-amber-500"/> Visão Financeira: {agenda.title}
          </h3>
          <p className="text-sm text-gray-500">Analise custos, taxas e gere preços dinâmicos para lotar as vagas.</p>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-blue-50 px-4 py-3 rounded-2xl border border-blue-100 min-w-[120px]">
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Lotação da Van</p>
            <p className="font-black text-xl text-blue-900">{ocupadas} / {agenda.max_capacity || 15}</p>
            <p className="text-xs text-blue-600 mt-1"><span className="font-bold">{pagantes.length}</span> Pagantes</p>
            <p className="text-xs text-blue-600"><span className="font-bold">{cortesias.length}</span> Guias/Pendentes</p>
            <p className="text-xs font-black text-blue-800 mt-2 bg-blue-100 px-2 py-1 rounded-lg inline-block">{vagasRestantes} vagas livres para venda</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
          <p className="text-xs text-gray-500 font-bold uppercase mb-1">Faturamento (Recebido)</p>
          <p className="font-black text-2xl text-gray-800">{formatCurrency(totalRev)}</p>
          <p className="text-xs text-gray-400 mt-1">{pagantes.length} pagamentos confirmados</p>
        </div>
        <div className="bg-red-50 p-5 rounded-2xl border border-red-100">
          <p className="text-xs text-red-500 font-bold uppercase mb-1">Custos Declarados</p>
          <p className="font-black text-2xl text-red-600">- {formatCurrency(totalCst)}</p>
          <p className="text-xs text-red-400 mt-1">Soma das despesas</p>
        </div>
        <div className={`p-5 rounded-2xl border ${netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
          <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${netProfit >= 0 ? 'text-green-700' : 'text-orange-700'}`}>
            {netProfit >= 0 ? 'Lucro Atual' : 'Prejuízo Atual'}
          </p>
          <p className={`font-black text-3xl ${netProfit >= 0 ? 'text-green-700' : 'text-orange-700'}`}>
            {formatCurrency(netProfit)}
          </p>
          <p className={`text-xs mt-1 ${netProfit >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
            {netProfit >= 0 ? 'A viagem já se pagou!' : 'Ainda faltam vendas para cobrir os custos.'}
          </p>
        </div>
      </div>

      {/* CONFIGURAÇÕES DE TAXAS */}
      <div className="bg-gray-50 rounded-2xl p-5 mb-8 border border-gray-100">
        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Percent className="w-4 h-4"/> Configurações de Taxas (Asaas) e Margem
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">Taxa % (ex: Cartão)</label>
            <input 
              type="number" step="0.01" 
              value={taxaPercentual} onChange={e => setTaxaPercentual(Number(e.target.value))}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">Taxa Fixa (R$)</label>
            <input 
              type="number" step="0.01" 
              value={taxaFixa} onChange={e => setTaxaFixa(Number(e.target.value))}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">Margem Alvo (%)</label>
            <input 
              type="number" step="1" 
              value={metamargem} onChange={e => setMetamargem(Number(e.target.value))}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex items-center mt-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-700">
              <input 
                type="checkbox" 
                checked={repassarTaxa} onChange={e => setRepassarTaxa(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
              />
              Repassar taxa ao cliente?
            </label>
          </div>
        </div>
      </div>

      {/* SIMULADOR DE PREÇOS */}
      <div className="bg-amber-50/50 border border-amber-100 rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Sparkles className="w-24 h-24 text-amber-500" />
        </div>
        
        <h4 className="font-black text-amber-800 text-lg mb-2 flex items-center gap-2 relative z-10">
          <Sparkles className="w-5 h-5"/> Motor de Preços e Descontos
        </h4>
        <p className="text-sm text-amber-900/80 mb-6 max-w-2xl relative z-10">
          Baseado nas {vagasRestantes} vagas restantes e na situação atual de lucro/prejuízo, veja quais valores você deve cobrar para bater suas metas ou lotar a van.
        </p>

        {vagasRestantes === 0 ? (
          <div className="bg-white p-4 rounded-xl border border-green-200 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-500"/>
            <div>
              <p className="font-bold text-gray-800">Trilha 100% Lotada!</p>
              <p className="text-sm text-gray-500">Não há mais vagas para simular descontos.</p>
            </div>
          </div>
        ) : netProfit < 0 ? (
          <div className="space-y-4 relative z-10">
            <div className="bg-white p-4 rounded-xl border border-red-200 flex gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500 shrink-0"/>
              <div>
                <p className="font-bold text-red-700 mb-1">Atenção: A viagem está operando no prejuízo.</p>
                <p className="text-sm text-red-600/80">Faltam {formatCurrency(Math.abs(netProfit))} para cobrir os custos. Se você vender as {vagasRestantes} vagas restantes a preços muito baixos, não vai recuperar o investimento.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(() => {
                const receitaNecessariaPorVaga = Math.abs(netProfit) / vagasRestantes;
                const precoEmpate = calcularPrecoParaReceita(receitaNecessariaPorVaga);
                
                const receitaLucro = receitaNecessariaPorVaga * (1 + (metamargem/100));
                const precoLucro = calcularPrecoParaReceita(receitaLucro);
                const lucroFinalProjetado = netProfit + (vagasRestantes * receitaLucro);

                return (
                  <>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Preço Mínimo (Zero a Zero)</p>
                        <p className="font-black text-2xl text-gray-800 mb-2">{formatCurrency(precoEmpate)}</p>
                        <p className="text-xs text-gray-500 leading-tight">
                          Cobrando este valor nas {vagasRestantes} vagas, você empata e não tem prejuízo. 
                          {precoEmpate > agenda.price && <span className="text-red-500 block mt-1">Alerta: Este valor é maior que o preço normal ({formatCurrency(agenda.price)}). A viagem corre risco de fechar no vermelho.</span>}
                        </p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-400">Projeção Final:</span>
                        <span className="text-sm font-black text-gray-600">{formatCurrency(0)}</span>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-green-500 flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Preço com Lucro ({metamargem}%)</p>
                        <p className="font-black text-2xl text-green-700 mb-2">
                          {formatCurrency(precoLucro)}
                        </p>
                        <p className="text-xs text-gray-500 leading-tight">
                          Preço para cobrir o buraco atual e ainda sair com {metamargem}% de lucro sobre as vagas restantes.
                        </p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                        <span className="text-xs font-bold text-green-600">Lucro Final Projetado:</span>
                        <span className="text-sm font-black text-green-700">{formatCurrency(lucroFinalProjetado)}</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="space-y-4 relative z-10">
            <div className="bg-white p-4 rounded-xl border border-green-200 flex gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0"/>
              <div>
                <p className="font-bold text-green-700 mb-1">Excelente! A viagem já se pagou.</p>
                <p className="text-sm text-green-600/80">Todo o valor recebido pelas próximas {vagasRestantes} vagas será lucro líquido. Use descontos agressivos para lotar a van rápido!</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Mega Promoção</p>
                  <p className="font-black text-2xl text-gray-800 mb-2">
                    {formatCurrency(calcularPrecoParaReceita(agenda.price * 0.5))}
                  </p>
                  <p className="text-xs text-gray-500 leading-tight">
                    ~50% de desconto. Venda relâmpago apenas para encher as últimas poltronas sem esforço.
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Projeção de Lucro:</span>
                  <span className="text-sm font-black text-green-600">{formatCurrency(netProfit + (vagasRestantes * agenda.price * 0.5))}</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">Desconto Estratégico</p>
                  <p className="font-black text-2xl text-blue-700 mb-2">
                    {formatCurrency(calcularPrecoParaReceita(agenda.price * 0.75))}
                  </p>
                  <p className="text-xs text-gray-500 leading-tight">
                    ~25% de desconto. Ótimo para quem pedir desconto chorando no WhatsApp.
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Projeção de Lucro:</span>
                  <span className="text-sm font-black text-green-600">{formatCurrency(netProfit + (vagasRestantes * agenda.price * 0.75))}</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-t-4 border-t-green-500 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Preço Cheio + Taxas</p>
                  <p className="font-black text-2xl text-green-700 mb-2">
                    {formatCurrency(calcularPrecoParaReceita(agenda.price))}
                  </p>
                  <p className="text-xs text-gray-500 leading-tight">
                    Preço normal ({formatCurrency(agenda.price)}) ajustado com as taxas Asaas para não perder nada.
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Projeção de Lucro:</span>
                  <span className="text-sm font-black text-green-600">{formatCurrency(netProfit + (vagasRestantes * agenda.price))}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
