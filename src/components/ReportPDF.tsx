import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

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

export const ReportPDF = ({ data }: { data: any }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>Relatório Inteligente - FinanceAI</Text>
      
      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={{ fontSize: 10, color: '#6b7280' }}>Total Receitas</Text>
          <Text style={{ fontSize: 14, color: '#10b981', fontWeight: 'bold' }}>R$ {data.receitas}</Text>
        </View>
        <View style={styles.card}>
          <Text style={{ fontSize: 10, color: '#6b7280' }}>Total Despesas</Text>
          <Text style={{ fontSize: 14, color: '#ef4444', fontWeight: 'bold' }}>R$ {data.despesas}</Text>
        </View>
        <View style={styles.card}>
          <Text style={{ fontSize: 10, color: '#6b7280' }}>Balanço do Mês</Text>
          <Text style={{ fontSize: 14, color: '#4f46e5', fontWeight: 'bold' }}>R$ {data.balanco}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Metas Alcançadas</Text>
        {data.metas && data.metas.length > 0 ? (
          data.metas.map((m: any, i: number) => (
            <Text key={i} style={styles.text}>- {m.titulo}: Concluída em {m.concluidoEm}</Text>
          ))
        ) : (
          <Text style={styles.text}>Nenhuma meta concluída neste período.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Alertas da IA</Text>
        {data.alertas && data.alertas.length > 0 ? (
          data.alertas.map((a: string, i: number) => (
            <Text key={i} style={styles.alertItem}>• {a}</Text>
          ))
        ) : (
          <Text style={styles.text}>Tudo sob controle! Nenhum alerta grave.</Text>
        )}
      </View>
      
      <Text style={{ fontSize: 10, textAlign: 'center', marginTop: 20, color: '#9ca3af' }}>
        Gerado via FinanceAI Pro - {new Date().toLocaleDateString('pt-BR')}
      </Text>
    </Page>
  </Document>
);
