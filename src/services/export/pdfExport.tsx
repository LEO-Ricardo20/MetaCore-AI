import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer'
import type { Project } from '@/types/project'

// 注册中文字体（黑体）
Font.register({
  family: 'NotoSansSC',
  src: `${import.meta.env.BASE_URL}fonts/simhei.ttf`,
})

const colors = {
  primary: '#6366f1',
  cyan: '#06b6d4',
  darkBg: '#0f172a',
  cardBg: '#1e293b',
  text: '#e2e8f0',
  muted: '#94a3b8',
  border: '#334155',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.darkBg,
    padding: 40,
    fontFamily: 'NotoSansSC',
  },
  coverPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    color: colors.primary,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    color: colors.text,
    fontFamily: 'NotoSansSC',
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 32,
    textAlign: 'center',
  },
  chipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 24,
  },
  chipText: {
    fontSize: 12,
    color: colors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 32,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 9,
    color: colors.muted,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 11,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    color: colors.text,
    fontFamily: 'NotoSansSC',
    fontWeight: 'bold',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  description: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 1.6,
    marginBottom: 24,
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    color: colors.muted,
    fontFamily: 'NotoSansSC',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCell: {
    fontSize: 9,
    color: colors.text,
  },
  tableCellMuted: {
    fontSize: 9,
    color: colors.muted,
  },
  bomTotal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  bomTotalLabel: {
    fontSize: 10,
    color: colors.muted,
    marginRight: 12,
  },
  bomTotalValue: {
    fontSize: 12,
    color: colors.green,
    fontFamily: 'NotoSansSC',
    fontWeight: 'bold',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageNumberText: {
    fontSize: 9,
    color: colors.muted,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: colors.muted,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
})

function HeaderCell({ text, width }: { text: string; width: number }) {
  return (
    <View style={{ width, paddingRight: 8 }}>
      <Text style={styles.tableHeaderCell}>{text}</Text>
    </View>
  )
}

function Cell({ text, width, muted = false }: { text: string; width: number; muted?: boolean }) {
  return (
    <View style={{ width, paddingRight: 8 }}>
      <Text style={muted ? styles.tableCellMuted : styles.tableCell}>{text}</Text>
    </View>
  )
}

function PinColorDot({ function: fn }: { function: string }) {
  let bg = colors.primary
  if (fn.includes('GND') || fn.includes('VSS')) bg = colors.red
  else if (fn.includes('3V3') || fn.includes('VCC') || fn.includes('VDD')) bg = colors.green
  else if (fn.includes('5V')) bg = colors.amber
  return <View style={[styles.colorDot, { backgroundColor: bg }]} />
}

interface Props {
  project: Project
}

function SchemeDocument({ project }: Props) {
  const scheme = project.scheme
  const totalPrice = scheme?.bom.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) ?? 0
  const date = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <Document>
      {/* 封面 */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverPage}>
          <Text style={styles.logo}>⚡</Text>
          <Text style={styles.title}>{project.name}</Text>
          <Text style={styles.subtitle}>{project.requirement || '硬件方案设计文档'}</Text>

          <View style={styles.chipBadge}>
            <Text style={styles.chipText}>{project.target} · {project.format}</Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>芯片平台</Text>
              <Text style={styles.metaValue}>{project.target}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>工程格式</Text>
              <Text style={styles.metaValue}>{project.format}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>生成日期</Text>
              <Text style={styles.metaValue}>{date}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>文件数量</Text>
              <Text style={styles.metaValue}>{project.codeFiles.length} 个</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {scheme?.description && (
            <Text style={styles.description}>{scheme.description}</Text>
          )}
        </View>

        <Text style={styles.footer}>MetaCore Studio · AI驱动的硬件架构工程师工具</Text>
        <View style={styles.pageNumber}>
          <Text style={styles.pageNumberText}>封面</Text>
          <Text style={styles.pageNumberText}>1 / 4</Text>
        </View>
      </Page>

      {/* 引脚分配 */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>引脚分配</Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <HeaderCell text="#" width={32} />
            <HeaderCell text="引脚名" width={64} />
            <HeaderCell text="功能" width={100} />
            <HeaderCell text="连接设备" width={100} />
            <HeaderCell text="电压" width={48} />
          </View>
          {scheme?.pins.map((pin, i) => (
            <View key={i} style={styles.tableRow}>
              <Cell text={pin.pinNumber} width={32} muted />
              <View style={{ width: 64, paddingRight: 8, flexDirection: 'row', alignItems: 'center' }}>
                <PinColorDot function={pin.function} />
                <Text style={styles.tableCell}>{pin.pinName}</Text>
              </View>
              <Cell text={pin.function} width={100} />
              <Cell text={pin.connectedTo} width={100} muted />
              <Cell text={pin.voltage || '-'} width={48} muted />
            </View>
          ))}
        </View>

        <Text style={styles.footer}>MetaCore Studio · AI驱动的硬件架构工程师工具</Text>
        <View style={styles.pageNumber}>
          <Text style={styles.pageNumberText}>引脚分配</Text>
          <Text style={styles.pageNumberText}>2 / 4</Text>
        </View>
      </Page>

      {/* BOM 清单 */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>BOM 物料清单</Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <HeaderCell text="#" width={24} />
            <HeaderCell text="器件名称" width={80} />
            <HeaderCell text="型号" width={100} />
            <HeaderCell text="数量" width={40} />
            <HeaderCell text="单价(¥)" width={48} />
            <HeaderCell text="小计(¥)" width={56} />
          </View>
          {scheme?.bom.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Cell text={String(i + 1)} width={24} muted />
              <Cell text={item.name} width={80} />
              <Cell text={item.model} width={100} muted />
              <Cell text={String(item.quantity)} width={40} />
              <Cell text={item.unitPrice.toFixed(2)} width={48} muted />
              <Cell text={(item.quantity * item.unitPrice).toFixed(2)} width={56} />
            </View>
          ))}
        </View>

        <View style={styles.bomTotal}>
          <Text style={styles.bomTotalLabel}>预估总价</Text>
          <Text style={styles.bomTotalValue}>¥ {totalPrice.toFixed(2)}</Text>
        </View>

        <Text style={styles.footer}>MetaCore Studio · AI驱动的硬件架构工程师工具</Text>
        <View style={styles.pageNumber}>
          <Text style={styles.pageNumberText}>BOM 物料清单</Text>
          <Text style={styles.pageNumberText}>3 / 4</Text>
        </View>
      </Page>

      {/* 接线表 */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>接线对照表</Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <HeaderCell text="起点" width={120} />
            <HeaderCell text="终点" width={120} />
            <HeaderCell text="线色" width={48} />
            <HeaderCell text="备注" width={60} />
          </View>
          {scheme?.wiring.map((entry, i) => (
            <View key={i} style={styles.tableRow}>
              <Cell text={entry.from} width={120} />
              <Cell text={entry.to} width={120} />
              <Cell text={entry.wireColor || '-'} width={48} muted />
              <Cell text={entry.note || '-'} width={60} muted />
            </View>
          ))}
        </View>

        {/* 工程文件列表 */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>生成代码文件</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <HeaderCell text="文件路径" width={240} />
            <HeaderCell text="语言" width={108} />
          </View>
          {project.codeFiles.map((file, i) => (
            <View key={i} style={styles.tableRow}>
              <Cell text={file.path} width={240} />
              <Cell text={file.language} width={108} muted />
            </View>
          ))}
        </View>

        <Text style={styles.footer}>MetaCore Studio · AI驱动的硬件架构工程师工具</Text>
        <View style={styles.pageNumber}>
          <Text style={styles.pageNumberText}>接线对照 & 代码文件</Text>
          <Text style={styles.pageNumberText}>4 / 4</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function exportPDF(project: Project): Promise<void> {
  const doc = <SchemeDocument project={project} />
  const blob = await pdf(doc).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${project.name || 'metacore-scheme'}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
