/** @jsxImportSource react */
import React from 'react';
import { Document, Page, Text as PdfText, View, StyleSheet } from '@react-pdf/renderer';

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
      <PdfText style={styles.header}>Relatório Inteligente - FinanceAI</PdfText>
      
      <View style={styles.grid}>
        <View style={styles.card}>
          <PdfText style={{ fontSize: 10, color: '#6b7280' }}>Total Receitas</PdfText>
          <PdfText style={{ fontSize: 14, color: '#10b981', fontWeight: 'bold' }}>R$ {data.receitas}</PdfText>
        </View>
        <View style={styles.card}>
          <PdfText style={{ fontSize: 10, color: '#6b7280' }}>Total Despesas</PdfText>
          <PdfText style={{ fontSize: 14, color: '#ef4444', fontWeight: 'bold' }}>R$ {data.despesas}</PdfText>
        </View>
        <View style={styles.card}>
          <PdfText style={{ fontSize: 10, color: '#6b7280' }}>Balanço do Mês</PdfText>
          <PdfText style={{ fontSize: 14, color: '#4f46e5', fontWeight: 'bold' }}>R$ {data.balanco}</PdfText>
        </View>
      </View>

      <View style={styles.section}>
        <PdfText style={styles.title}>Metas Alcançadas</PdfText>
        {data.metas && data.metas.length > 0 ? (
          data.metas.map((m: any, i: number) => (
            <PdfText key={i} style={styles.text}>- {m.titulo}: Concluída em {m.concluidoEm}</PdfText>
          ))
        ) : (
          <PdfText style={styles.text}>Nenhuma meta concluída neste período.</PdfText>
        )}
      </View>

      <View style={styles.section}>
        <PdfText style={styles.title}>Alertas da IA</PdfText>
        {data.alertas && data.alertas.length > 0 ? (
          data.alertas.map((a: string, i: number) => (
            <PdfText key={i} style={styles.alertItem}>• {a}</PdfText>
          ))
        ) : (
          <PdfText style={styles.text}>Tudo sob controle! Nenhum alerta grave.</PdfText>
        )}
      </View>
      
      <PdfText style={{ fontSize: 10, textAlign: 'center', marginTop: 20, color: '#9ca3af' }}>
        Gerado via FinanceAI Pro - {new Date().toLocaleDateString('pt-BR')}
      </PdfText>
    </Page>
  </Document>
);
