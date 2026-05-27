import React from 'react';
import ReactPDF, { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { flexDirection: 'column', backgroundColor: '#FFFFFF', padding: 30 },
  header: { fontSize: 24, textAlign: 'center', marginBottom: 20, fontWeight: 'bold' },
  section: { margin: 10, padding: 10, flexGrow: 1 },
  title: { fontSize: 18, marginBottom: 10, fontWeight: 'bold', color: '#4f46e5' },
  text: { fontSize: 12, marginBottom: 5, color: '#333333' },
  alertItem: { fontSize: 12, marginBottom: 5, color: '#eab308' },
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  card: { padding: 10, backgroundColor: '#f3f4f6', borderRadius: 5, width: '30%' },
});

const ReportPDF = ({ data }: { data: any }) => {
  const safeData = data || {};
  const metas = safeData.metas || [];
  const alertas = safeData.alertas || [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Relatório Inteligente - FinanceAI</Text>
        
        <View style={styles.grid}>
          <View style={styles.card}>
            <Text style={{ fontSize: 10, color: '#6b7280' }}>Total Receitas</Text>
            <Text style={{ fontSize: 14, color: '#10b981', fontWeight: 'bold' }}>R$ {safeData.receitas || '0.00'}</Text>
          </View>
          <View style={styles.card}>
            <Text style={{ fontSize: 10, color: '#6b7280' }}>Total Despesas</Text>
            <Text style={{ fontSize: 14, color: '#ef4444', fontWeight: 'bold' }}>R$ {safeData.despesas || '0.00'}</Text>
          </View>
          <View style={styles.card}>
            <Text style={{ fontSize: 10, color: '#6b7280' }}>Balanço do Mês</Text>
            <Text style={{ fontSize: 14, color: '#4f46e5', fontWeight: 'bold' }}>R$ {safeData.balanco || '0.00'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Metas Alcançadas</Text>
          {metas.length > 0 ? (
            metas.map((m: any, i: number) => (
              <Text key={i} style={styles.text}>- {m.titulo}: Concluido em {m.concluidoEm || 'Breve'}</Text>
            ))
          ) : (
            <Text style={styles.text}>Nenhuma meta concluida neste periodo.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Alertas da IA</Text>
          {alertas.length > 0 ? (
            alertas.map((a: string, i: number) => (
              <Text key={i} style={styles.alertItem}>* {a}</Text>
            ))
          ) : (
            <Text style={styles.text}>Tudo sob controle! Nenhum alerta grave.</Text>
          )}
        </View>
        
        <Text style={{ fontSize: 10, textAlign: 'center', marginTop: 20, color: '#9ca3af' }}>
          Gerado via FinanceAI Pro
        </Text>
      </Page>
    </Document>
  );
};

export async function generatePdfStream(data: any) {
  try {
    const dados = data || {};
    const transacoes = dados.transacoes ?? [];
    const metas = dados.metas ?? [];
    const funcionarios = dados.funcionarios ?? [];
    const receitas = dados.receitas ?? 0;
    const despesas = dados.despesas ?? 0;

    // @ts-ignore
    const renderToStream = ReactPDF.renderToStream || ReactPDF.default.renderToStream;
    
    // Garantia de robustez e tratamento contra falhas silenciosas na busca de subcoleções do Firestore:
    // const transacoes = snapshot.docs.map(d => d.data()) || [];
    // const metas = metasSnapshot.docs.map(d => d.data()) || [];
    
    return await renderToStream(<ReportPDF data={{ ...dados, transacoes, metas, funcionarios, receitas, despesas }} />);
  } catch (err) {
    console.error('[serverReportGenerator] Falha ao renderizar PDF:', err);
    throw err;
  }
}
