import { jsPDF } from 'jspdf';
import type { SystemMetrics, ArchNode, ArchEdge, CloudProvider } from '../types';
import { getArbitrageCosts } from './costEngine';
import { toastBus } from '../lib/toastBus';
import { captureArchitectureAsImage } from './exportRenderer';

export interface ReportConfig {
  nodes: ArchNode[];
  edges: ArchEdge[];
  metrics: SystemMetrics;
  projectName: string;
  isWhiteLabel: boolean;
  cloudProvider: CloudProvider;
}

export async function generateArchitectureReport({
  nodes,
  edges,
  metrics,
  projectName,
  isWhiteLabel,
  cloudProvider
}: ReportConfig) {
  try {
    toastBus.emit('Generating High-Res Report...', 'info');
    
    // 1. Capture Canvas
    const dataUrl = await captureArchitectureAsImage(nodes, edges);

    // 2. Initialize PDF (A4 Portrait)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    
    // --- Helper for drawing Headers ---
    const drawHeader = (title: string, subtitle?: string) => {
      pdf.setFillColor(15, 23, 42); // slate-900
      pdf.rect(0, 0, pageWidth, 45, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(22);
      pdf.text(title, margin, 22);
      if (subtitle) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(148, 163, 184); // slate-400
        pdf.text(subtitle, margin, 32);
      }
      if (!isWhiteLabel) {
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);
        pdf.text('ArchViz Enterprise', pageWidth - margin, 27, { align: 'right' });
      }
    };

    // ══════════════════════════════════════════════════════════
    // PAGE 1: DIAGRAM
    // ══════════════════════════════════════════════════════════
    drawHeader(projectName, 'System Architecture Blueprint');

    // Canvas Image Background Layer
    pdf.setFillColor(248, 250, 252); // slate-50
    pdf.rect(margin, 55, pageWidth - margin * 2, pageHeight - 75, 'F');
    pdf.setDrawColor(226, 232, 240); // slate-200
    pdf.setLineWidth(0.5);
    pdf.rect(margin, 55, pageWidth - margin * 2, pageHeight - 75, 'S');

    // Calculate aspect ratio for image
    const imgProps = pdf.getImageProperties(dataUrl);
    const pdfImgWidth = pageWidth - margin * 2 - 10;
    const maxImgHeight = pageHeight - 85;
    let finalImgHeight = (imgProps.height * pdfImgWidth) / imgProps.width;
    let finalImgWidth = pdfImgWidth;

    if (finalImgHeight > maxImgHeight) {
      finalImgHeight = maxImgHeight;
      finalImgWidth = (imgProps.width * finalImgHeight) / imgProps.height;
    }
    
    const imgX = margin + 5 + (pdfImgWidth - finalImgWidth) / 2;
    pdf.addImage(dataUrl, 'PNG', imgX, 60, finalImgWidth, finalImgHeight);

    // ══════════════════════════════════════════════════════════
    // PAGE 2: ANALYTICS & ARBITRAGE
    // ══════════════════════════════════════════════════════════
    pdf.addPage();
    drawHeader('Architecture Assessment', 'Financials, Health, and SLA Telemetry');

    let currentY = 60;

    // --- Cloud Arbitrage Cards ---
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(30, 41, 59); // slate-800
    pdf.text('Multi-Cloud Arbitrage', margin, currentY);
    currentY += 10;

    const arb = getArbitrageCosts(nodes, edges);
    const cardWidth = (pageWidth - margin * 2 - 10) / 3;
    const clouds = [
      { name: 'AWS', cost: arb.aws, color: [245, 158, 11] as [number, number, number], bg: [254, 243, 199] as [number, number, number], id: 'aws' },
      { name: 'Google Cloud', cost: arb.gcp, color: [59, 130, 246] as [number, number, number], bg: [219, 234, 254] as [number, number, number], id: 'gcp' },
      { name: 'Azure', cost: arb.azure, color: [14, 165, 233] as [number, number, number], bg: [224, 242, 254] as [number, number, number], id: 'azure' }
    ];

    clouds.forEach((c, idx) => {
      const x = margin + idx * (cardWidth + 5);
      
      // Card Background
      pdf.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
      pdf.roundedRect(x, currentY, cardWidth, 35, 3, 3, 'F');
      
      // Border if selected
      if (cloudProvider === c.id) {
        pdf.setDrawColor(c.color[0], c.color[1], c.color[2]);
        pdf.setLineWidth(1);
        pdf.roundedRect(x, currentY, cardWidth, 35, 3, 3, 'S');
      }

      // Card Title
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(c.color[0], c.color[1], c.color[2]);
      pdf.text(c.name, x + 5, currentY + 10);
      
      if (cloudProvider === c.id) {
        pdf.setFontSize(8);
        pdf.text('(Active)', x + cardWidth - 5, currentY + 10, { align: 'right' });
      }

      // Cost
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(16);
      pdf.setTextColor(15, 23, 42); // slate-900
      pdf.text(`$${c.cost.toLocaleString()}`, x + 5, currentY + 22);

      // Label
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.text('/ month', x + 5, currentY + 28);
    });

    currentY += 55;

    // --- Reliability & SLA ---
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(30, 41, 59);
    pdf.text('Reliability & Telemetry', margin, currentY);
    currentY += 10;

    // SLA Box
    pdf.setFillColor(241, 245, 249); // slate-100
    pdf.roundedRect(margin, currentY, pageWidth - margin * 2, 40, 3, 3, 'F');

    // Grade Badge
    const gradeColors: Record<string, [number, number, number]> = {
      'A': [16, 185, 129], // green
      'B': [59, 130, 246], // blue
      'C': [245, 158, 11], // orange
      'D': [239, 68, 68],  // red
      'F': [220, 38, 38]   // dark red
    };
    const gc = gradeColors[metrics.letterGrade] || [100, 116, 139];
    
    pdf.setFillColor(gc[0], gc[1], gc[2]);
    pdf.circle(margin + 20, currentY + 20, 12, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text(metrics.letterGrade, margin + 20, currentY + 22, { align: 'center', baseline: 'middle' });

    // Text rows inside SLA box
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(10);
    pdf.text(`Health Score: ${metrics.healthScore}/100`, margin + 45, currentY + 15);
    pdf.text(`Composite SLA: ${metrics.compositeSLA.toFixed(4)}% (${metrics.nines} Nines)`, margin + 45, currentY + 23);
    pdf.text(`Max Est. Downtime: ${metrics.downtimePerYear} / year`, margin + 45, currentY + 31);
    
    currentY += 60;

    // ══════════════════════════════════════════════════════════
    // PAGE 3: COMPLIANCE & WARNINGS
    // ══════════════════════════════════════════════════════════
    if (metrics.warnings.length > 0) {
      pdf.addPage();
      drawHeader('Security & Compliance', 'Vulnerability Assessment & Warnings');
      
      currentY = 60;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(30, 41, 59);
      pdf.text(`Active Findings (${metrics.warnings.length})`, margin, currentY);
      currentY += 10;

      metrics.warnings.forEach((warn: { type: string; message: string }) => {
        if (currentY > pageHeight - 40) { 
          pdf.addPage(); 
          drawHeader('Security & Compliance (Cont.)');
          currentY = 60; 
        }

        const isCrit = warn.type === 'critical';
        
        // Background strip
        pdf.setFillColor(isCrit ? 254 : 255, isCrit ? 226 : 243, isCrit ? 226 : 205); // light red or light yellow
        pdf.roundedRect(margin, currentY, pageWidth - margin * 2, 14, 2, 2, 'F');
        
        // Icon / Type
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(isCrit ? 220 : 217, isCrit ? 38 : 119, isCrit ? 38 : 6); // dark red or dark amber
        pdf.text(warn.type.toUpperCase(), margin + 5, currentY + 9);

        // Message
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(15, 23, 42);
        
        // Wrap text to prevent overflow
        const messageLines = pdf.splitTextToSize(warn.message, pageWidth - margin * 2 - 30);
        let blockHeight = 14;
        if (messageLines.length > 1) {
          blockHeight = 10 + (messageLines.length * 5);
          pdf.setFillColor(isCrit ? 254 : 255, isCrit ? 226 : 243, isCrit ? 226 : 205);
          pdf.roundedRect(margin, currentY, pageWidth - margin * 2, blockHeight, 2, 2, 'F');
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(isCrit ? 220 : 217, isCrit ? 38 : 119, isCrit ? 38 : 6);
          pdf.text(warn.type.toUpperCase(), margin + 5, currentY + 9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(15, 23, 42);
        }

        pdf.text(messageLines, margin + 25, currentY + 9);
        currentY += blockHeight + 4;
      });
    }

    // Save
    pdf.save(`${projectName.replace(/ /g, '_')}_Pro_Report.pdf`);
    toastBus.emit('Report Downloaded Successfully!', 'success');

  } catch (err) {
    console.error('Report Generation Error', err);
    toastBus.emit('Failed to generate report', 'error');
  }
}
