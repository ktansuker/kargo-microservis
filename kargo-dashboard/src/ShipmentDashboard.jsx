import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_KARGO_API_URL) ||
  'http://74.162.65.83:3000';
const POLL_INTERVAL_MS = 5000;
const USE_MOCK_FALLBACK = true; 

const normalize = (s = '') =>
  s.toString().toUpperCase().replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C');

const STATUS_MAP = {
  BEKLIYOR: { label: 'Bekliyor', color: '#8B98A0', glow: 'rgba(139,152,160,0.25)', order: 0 },
  PENDING: { label: 'Bekliyor', color: '#8B98A0', glow: 'rgba(139,152,160,0.25)', order: 0 },
  YENIDEN_DENENIYOR: { label: 'Yeniden Deneniyor', color: '#FF8A3D', glow: 'rgba(255,138,61,0.3)', order: 1 },
  RETRYING: { label: 'Yeniden Deneniyor', color: '#FF8A3D', glow: 'rgba(255,138,61,0.3)', order: 1 },
  BASARILI: { label: 'Başarılı', color: '#3DDC84', glow: 'rgba(61,220,132,0.3)', order: 2 },
  SUCCESS: { label: 'Başarılı', color: '#3DDC84', glow: 'rgba(61,220,132,0.3)', order: 2 },
  HATALI_DMQ: { label: 'Hatalı (DMQ)', color: '#FF5C5C', glow: 'rgba(255,92,92,0.3)', order: 3 },
  FAILED: { label: 'Hatalı (DMQ)', color: '#FF5C5C', glow: 'rgba(255,92,92,0.3)', order: 3 },
  DOGRULAMA_HATASI: { label: 'Doğrulama Hatası', color: '#C97DFF', glow: 'rgba(201,125,255,0.3)', order: 4 },
  VALIDATION_FAILED: { label: 'Doğrulama Hatası', color: '#C97DFF', glow: 'rgba(201,125,255,0.3)', order: 4 },
};

const getStatusMeta = (raw) => STATUS_MAP[normalize(raw)] || { label: raw || 'Bilinmiyor', color: '#5B6670', glow: 'rgba(91,102,112,0.25)', order: 9 };
const PROVIDER_COLORS = { Borusan: '#4EA1FF', Yurtici: '#FFC24E', Aras: '#FF6E9A' };

// Mock data generator for testing
function generateMock(count = 45) {
  const providers = ['Borusan', 'Aras', 'Yurtici'];
  const statuses = ['BEKLIYOR', 'BASARILI', 'YENIDEN_DENENIYOR', 'HATALI_DMQ', 'DOGRULAMA_HATASI'];
  const names = ['Ebru Böke', 'Ahmet Yılmaz', 'Merve Kaya', 'Can Demir', 'Zeynep Arslan', 'Emre Şahin'];
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const created = now - Math.floor(Math.random() * 1000 * 60 * 90);
    return {
      id: `mock-${i}`,
      transactionId: `TRX-${providers[i % 3].slice(0, 3).toUpperCase()}-${1000 + i}`,
      cargoProviderCode: providers[i % providers.length],
      consignmentNo: `85859080${(1000 + i).toString().padStart(4, '0')}`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      recipientName: names[i % names.length],
      errorMessage: null,
      createdAt: new Date(created).toISOString(),
      updatedAt: new Date(created + Math.random() * 60000).toISOString(),
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return 'az önce';
  if (diff < 60) return `${diff} sn önce`;
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  return `${Math.floor(diff / 86400)} gün önce`;
}

export default function ShipmentDashboard() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);
  const [error, setError] = useState(null);
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(''); // Performans için yeni eklendi
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [providerFilter, setProviderFilter] = useState('ALL');
  
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selected, setSelected] = useState(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const mockRef = useRef(generateMock());

  // Arama çubuğuna yazılan metni 500ms bekletip öyle API'ye gönderir
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); 
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchShipments = useCallback(async () => {
    try {
      // Backend'e tüm parametreleri yolluyoruz
      const params = new URLSearchParams({ page: currentPage, limit: 20 });
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (providerFilter !== 'ALL') params.append('provider', providerFilter);
      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await fetch(`${API_BASE_URL}/shipment/list?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      if (data && data.items) {
        setShipments(data.items);
        setTotalPages(data.meta.totalPages || 1);
      } else {
        setShipments(Array.isArray(data) ? data : []);
        setTotalPages(1);
      }
      setIsMock(false); setError(null);
    } catch (err) {
      if (USE_MOCK_FALLBACK) {
        // Mock veri tarafında sahte filtreleme ve sayfalama simülasyonu
        let allMock = mockRef.current.map((s) => ({ ...s }));
        if (statusFilter !== 'ALL') allMock = allMock.filter(s => normalize(s.status) === statusFilter);
        if (providerFilter !== 'ALL') allMock = allMock.filter(s => s.cargoProviderCode === providerFilter);
        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase();
          allMock = allMock.filter(s => `${s.transactionId} ${s.consignmentNo} ${s.recipientName || ''}`.toLowerCase().includes(q));
        }
        
        const limit = 20;
        const startIndex = (currentPage - 1) * limit;
        setShipments(allMock.slice(startIndex, startIndex + limit));
        setTotalPages(Math.ceil(allMock.length / limit) || 1);
        setIsMock(true); setError(err.message);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, [currentPage, statusFilter, providerFilter, debouncedSearch]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchShipments, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoRefresh, fetchShipments]);

  const handleStatusFilter = (key) => { setStatusFilter(key); setCurrentPage(1); };
  const handleProviderFilter = (key) => { setProviderFilter(key); setCurrentPage(1); };

  const stats = useMemo(() => {
    const counts = {};
    shipments.forEach((s) => {
      const key = normalize(s.status);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [shipments]);

  const totalCount = shipments.length;
  // Provider listesini backendden dönen güncel verilere göre oluştur
  const providers = ['Borusan', 'Yurtici', 'Aras']; // Dashboard için sabit kargo firmaları

  return (
    <div style={styles.page}>
      <style>{css}</style>
      <div className="grain" />

      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoMark}>
            <span style={styles.logoBox} />
            <span style={styles.logoBox} />
            <span style={styles.logoBox} />
          </div>
          <div>
            <div style={styles.title}>KARGO OPERASYON MERKEZİ</div>
            <div style={styles.subtitle}>Sevkiyat İzleme Panosu</div>
          </div>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.liveBadge}>
            <span className={`pulse-dot ${isMock ? 'pulse-dot--warn' : 'pulse-dot--live'}`} />
            {isMock ? 'BAĞLANTI YOK — DEMO VERİ' : 'CANLI'}
          </div>
          <div style={styles.updatedText}>
            {lastUpdated ? `Son güncelleme: ${timeAgo(lastUpdated.toISOString())}` : '—'}
          </div>
          <button onClick={() => setAutoRefresh((v) => !v)} style={{ ...styles.toggleBtn, ...(autoRefresh ? styles.toggleBtnOn : {}) }}>
            {autoRefresh ? 'Oto-Yenile: Açık' : 'Oto-Yenile: Kapalı'}
          </button>
        </div>
      </header>

      <section style={styles.statStrip}>
        <StatCard label="Ekranda Görünen" value={totalCount} color="#E8EDF0" />
        {Object.entries(STATUS_MAP)
          .filter((entry, idx, arr) => arr.findIndex(([, v]) => v.label === entry[1].label) === idx)
          .sort((a, b) => a[1].order - b[1].order)
          .map(([key, meta]) => (
            <StatCard key={key} label={meta.label} value={stats[key] || 0} color={meta.color} glow={meta.glow} />
          ))}
      </section>

      <section style={styles.filterBar}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Veritabanında ara (TransactionID, Konsinye no)…"
          style={styles.searchInput}
        />
        <div style={styles.filterGroup}>
          <FilterPill active={providerFilter === 'ALL'} onClick={() => handleProviderFilter('ALL')}>
            Tüm Sağlayıcılar
          </FilterPill>
          {providers.map((p) => (
            <FilterPill key={p} active={providerFilter === p} onClick={() => handleProviderFilter(p)} dot={PROVIDER_COLORS[p] || '#8B98A0'}>
              {p}
            </FilterPill>
          ))}
        </div>
        <div style={styles.filterGroup}>
          <FilterPill active={statusFilter === 'ALL'} onClick={() => handleStatusFilter('ALL')}>
            Tüm Statüler
          </FilterPill>
          {['BEKLIYOR', 'YENIDEN_DENENIYOR', 'BASARILI', 'HATALI_DMQ', 'DOGRULAMA_HATASI'].map((key) => (
            <FilterPill key={key} active={statusFilter === key} onClick={() => handleStatusFilter(key)} dot={STATUS_MAP[key].color}>
              {STATUS_MAP[key].label}
            </FilterPill>
          ))}
        </div>
      </section>

      <section style={styles.listWrap}>
        {loading ? (
          <div style={styles.emptyState}>
            <div style={styles.emptySpinner} />
            <div>Sevkiyatlar yükleniyor…</div>
          </div>
        ) : shipments.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyGlyph}>◇</div>
            <div style={styles.emptyTitle}>Kayıt bulunamadı</div>
            <div style={styles.emptyText}>Belirlediğin filtrelere uygun kargo bulunmuyor.</div>
          </div>
        ) : (
          shipments.map((s) => (
            <ManifestRow key={s.id} shipment={s} onClick={() => setSelected(s)} isOpen={selected?.id === s.id} />
          ))
        )}
      </section>

      {!loading && totalPages > 1 && (
        <section style={styles.paginationWrap}>
          <button style={{ ...styles.pageBtn, ...(currentPage === 1 ? styles.pageBtnDisabled : {}) }} disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
            ← Geri
          </button>
          <div style={styles.pageInfo}>Sayfa {currentPage} / {totalPages}</div>
          <button style={{ ...styles.pageBtn, ...(currentPage === totalPages ? styles.pageBtnDisabled : {}) }} disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
            İleri →
          </button>
        </section>
      )}

      {selected && <DetailDrawer shipment={selected} onClose={() => setSelected(null)} />}
      {error && !isMock && <div style={styles.errorToast}>API hatası: {error}</div>}
    </div>
  );
}

// Alt bileşenler
function StatCard({ label, value, color, glow }) {
  return (
    <div style={{ ...styles.statCard, boxShadow: glow ? `0 0 0 1px rgba(255,255,255,0.04), inset 0 0 24px ${glow}` : styles.statCard.boxShadow }}>
      <div style={{ ...styles.statValue, color }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function FilterPill({ active, onClick, children, dot }) {
  return (
    <button onClick={onClick} style={{ ...styles.pill, ...(active ? styles.pillActive : {}) }}>
      {dot && <span style={{ ...styles.pillDot, background: dot }} />}
      {children}
    </button>
  );
}

function ManifestRow({ shipment, onClick, isOpen }) {
  const meta = getStatusMeta(shipment.status);
  const providerColor = PROVIDER_COLORS[shipment.cargoProviderCode] || '#8B98A0';
  return (
    <div style={{ ...styles.row, ...(isOpen ? styles.rowOpen : {}) }} onClick={onClick}>
      <div style={styles.rowStub}>
        <span style={{ ...styles.providerDot, background: providerColor }} />
        <span style={styles.providerText}>{shipment.cargoProviderCode || '—'}</span>
      </div>
      <div style={styles.rowPerf} />
      <div style={styles.rowMain}>
        <div style={styles.rowTop}>
          <span style={styles.trxId}>{shipment.transactionId}</span>
          <span style={styles.consNo}>#{shipment.consignmentNo}</span>
        </div>
        <div style={styles.rowBottom}>
          <span style={styles.recipient}>{shipment.recipientName || 'Alıcı bilgisi yok'}</span>
          <span style={styles.timeAgo}>{timeAgo(shipment.createdAt)}</span>
        </div>
      </div>
      <div style={styles.rowStatus}>
        <span style={{ ...styles.statusBadge, color: meta.color, borderColor: meta.color + '55', background: meta.color + '14' }}>
          <span style={{ ...styles.statusDot, background: meta.color }} />
          {meta.label}
        </span>
      </div>
    </div>
  );
}

function DetailDrawer({ shipment, onClose }) {
  const meta = getStatusMeta(shipment.status);
  return (
    <div style={styles.drawerOverlay} onClick={onClose}>
      <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div style={styles.drawerHeader}>
          <div>
            <div style={styles.drawerTrx}>{shipment.transactionId}</div>
            <div style={styles.drawerCons}>Konsinye No: {shipment.consignmentNo}</div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <div style={{ ...styles.drawerStatus, borderColor: meta.color + '55', background: meta.color + '10' }}>
          <span style={{ ...styles.statusDot, background: meta.color }} />
          <span style={{ color: meta.color, fontWeight: 700 }}>{meta.label}</span>
        </div>
        <div style={styles.drawerGrid}>
          <Field label="Kargo Sağlayıcı" value={shipment.cargoProviderCode} />
          <Field label="Alıcı" value={shipment.recipientName || '—'} />
          <Field label="Oluşturulma" value={new Date(shipment.createdAt).toLocaleString('tr-TR')} />
          <Field label="Son Güncelleme" value={new Date(shipment.updatedAt).toLocaleString('tr-TR')} />
        </div>
        {shipment.errorMessage && (
          <div style={styles.errorBox}>
            <div style={styles.errorBoxLabel}>Hata Detayı</div>
            <div style={styles.errorBoxText}>{shipment.errorMessage}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.fieldValue}>{value}</div>
    </div>
  );
}

const MONO = "'IBM Plex Mono', 'SF Mono', Menlo, monospace";
const SANS = "'Inter', -apple-system, 'Segoe UI', sans-serif";

const styles = {
  page: { minHeight: '100vh', background: 'radial-gradient(ellipse at top, #141B1F 0%, #0C1013 60%)', color: '#E8EDF0', fontFamily: SANS, padding: '28px 32px 80px', position: 'relative' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 28 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  logoMark: { display: 'flex', flexDirection: 'column', gap: 3 },
  logoBox: { width: 18, height: 4, background: '#FF8A3D', display: 'block' },
  title: { fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: '0.14em', color: '#F1F4F5' },
  subtitle: { fontSize: 12, color: '#7C8890', marginTop: 3, letterSpacing: '0.02em' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 16 },
  liveBadge: { display: 'flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', color: '#B8C2C8', background: '#161D21', border: '1px solid #262F34', padding: '7px 12px', borderRadius: 20 },
  updatedText: { fontSize: 11, color: '#5B6670', fontFamily: MONO },
  toggleBtn: { fontFamily: MONO, fontSize: 11, color: '#8B98A0', background: 'transparent', border: '1px solid #262F34', padding: '7px 12px', borderRadius: 20, cursor: 'pointer', transition: 'all .15s' },
  toggleBtnOn: { color: '#3DDC84', borderColor: '#3DDC8455', background: '#3DDC840D' },
  statStrip: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 22 },
  statCard: { background: '#141A1E', border: '1px solid #21282C', borderRadius: 10, padding: '14px 16px' },
  statValue: { fontFamily: MONO, fontSize: 26, fontWeight: 700, lineHeight: 1 },
  statLabel: { fontSize: 11, color: '#7C8890', marginTop: 8, letterSpacing: '0.02em' },
  filterBar: { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20, alignItems: 'center' },
  searchInput: { flex: '1 1 260px', background: '#141A1E', border: '1px solid #21282C', borderRadius: 8, padding: '10px 14px', color: '#E8EDF0', fontSize: 13, fontFamily: SANS, outline: 'none' },
  filterGroup: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  pill: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontFamily: SANS, color: '#8B98A0', background: 'transparent', border: '1px solid #21282C', padding: '7px 12px', borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap' },
  pillActive: { color: '#E8EDF0', borderColor: '#3A444A', background: '#1B2226' },
  pillDot: { width: 6, height: 6, borderRadius: '50%', display: 'inline-block' },
  listWrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  paginationWrap: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 24, padding: '10px 0' },
  pageBtn: { background: '#141A1E', border: '1px solid #21282C', color: '#E8EDF0', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: MONO, fontSize: 12, transition: 'all 0.2s' },
  pageBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  pageInfo: { fontFamily: MONO, fontSize: 13, color: '#8B98A0' },
  row: { display: 'flex', alignItems: 'stretch', background: '#141A1E', border: '1px solid #21282C', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', transition: 'border-color .15s, transform .1s' },
  rowOpen: { borderColor: '#FF8A3D66' },
  rowStub: { width: 84, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#101518', padding: '10px 6px' },
  providerDot: { width: 8, height: 8, borderRadius: '50%' },
  providerText: { fontFamily: MONO, fontSize: 10, color: '#8B98A0', letterSpacing: '0.04em' },
  rowPerf: { width: 0, borderLeft: '1px dashed #2A333A' },
  rowMain: { flex: 1, padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' },
  rowTop: { display: 'flex', alignItems: 'baseline', gap: 10 },
  trxId: { fontFamily: MONO, fontSize: 13, color: '#E8EDF0', fontWeight: 600 },
  consNo: { fontFamily: MONO, fontSize: 11.5, color: '#5B6670' },
  rowBottom: { display: 'flex', justifyContent: 'space-between', gap: 10 },
  recipient: { fontSize: 12.5, color: '#9AA5AC' },
  timeAgo: { fontSize: 11, color: '#5B6670', fontFamily: MONO },
  rowStatus: { display: 'flex', alignItems: 'center', padding: '0 18px' },
  statusBadge: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 600, padding: '6px 12px', borderRadius: 20, border: '1px solid', whiteSpace: 'nowrap' },
  statusDot: { width: 6, height: 6, borderRadius: '50%' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', color: '#5B6670', gap: 8, border: '1px dashed #21282C', borderRadius: 12 },
  emptyGlyph: { fontSize: 28, color: '#3A444A' },
  emptyTitle: { fontSize: 14, color: '#8B98A0', fontWeight: 600 },
  emptyText: { fontSize: 12.5, textAlign: 'center', maxWidth: 320 },
  emptySpinner: { width: 22, height: 22, border: '2px solid #21282C', borderTopColor: '#FF8A3D', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  errorToast: { position: 'fixed', bottom: 20, right: 20, background: '#1B1416', border: '1px solid #FF5C5C55', color: '#FF9B9B', padding: '10px 16px', borderRadius: 8, fontSize: 12, fontFamily: MONO },
  drawerOverlay: { position: 'fixed', inset: 0, background: 'rgba(6,9,10,0.6)', backdropFilter: 'blur(2px)', display: 'flex', justifyContent: 'flex-end', zIndex: 50 },
  drawer: { width: 380, maxWidth: '90vw', height: '100%', background: '#12171A', borderLeft: '1px solid #21282C', padding: 26, overflowY: 'auto' },
  drawerHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  drawerTrx: { fontFamily: MONO, fontSize: 15, fontWeight: 700, color: '#F1F4F5' },
  drawerCons: { fontSize: 12, color: '#7C8890', marginTop: 4, fontFamily: MONO },
  closeBtn: { background: 'transparent', border: '1px solid #262F34', color: '#8B98A0', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer' },
  drawerStatus: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, border: '1px solid', marginBottom: 22, fontSize: 13 },
  drawerGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
  fieldLabel: { fontSize: 10.5, color: '#5B6670', letterSpacing: '0.04em', marginBottom: 4, textTransform: 'uppercase' },
  fieldValue: { fontSize: 13, color: '#D6DCDF' },
  errorBox: { background: '#1B1416', border: '1px solid #FF5C5C33', borderRadius: 8, padding: 14 },
  errorBoxLabel: { fontSize: 10.5, color: '#FF9B9B', letterSpacing: '0.04em', marginBottom: 6, textTransform: 'uppercase' },
  errorBoxText: { fontSize: 12.5, color: '#E0A9A9', lineHeight: 1.5, fontFamily: MONO },
};

const css = `
  * { box-sizing: border-box; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(0.8); } }
  .pulse-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
  .pulse-dot--live { background: #3DDC84; animation: pulse 1.6s ease-in-out infinite; }
  .pulse-dot--warn { background: #FF8A3D; animation: pulse 1.6s ease-in-out infinite; }
  input::placeholder { color: #5B6670; }
  input:focus { border-color: #3A444A !important; }
  button:hover { filter: brightness(1.2); }
  button:disabled:hover { filter: none; }
`;