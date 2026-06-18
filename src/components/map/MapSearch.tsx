import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, X, Loader2 } from 'lucide-react';

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string];
}

interface MapSearchProps {
  onLocationSelect: (lat: number, lng: number, boundingbox?: [number, number, number, number]) => void;
}

export default function MapSearch({ onLocationSelect }: MapSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchLocation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setIsOpen(true);
    try {
      // Nominatim API for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error searching location:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    let bbox: [number, number, number, number] | undefined;
    if (result.boundingbox && result.boundingbox.length === 4) {
      bbox = [
        parseFloat(result.boundingbox[0]), // south
        parseFloat(result.boundingbox[1]), // north
        parseFloat(result.boundingbox[2]), // west
        parseFloat(result.boundingbox[3])  // east
      ];
    }
    
    onLocationSelect(lat, lng, bbox);
    setQuery(result.display_name.split(',')[0]); // Set input to the main place name
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative z-[2000]" style={{ width: '360px', maxWidth: '90vw' }}>
      <div
        className="flex items-center"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-md)',
          borderRadius: '24px',
          padding: '4px 4px 4px 16px',
          backdropFilter: 'blur(20px)',
          boxShadow: 'var(--shadow-float)',
        }}
      >
        <Search size={18} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={query}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              searchLocation();
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value === '') {
              setResults([]);
              setIsOpen(false);
            }
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder="Страна, город, адрес..."
          className="flex-1 bg-transparent border-none outline-none font-medium min-w-0"
          style={{
            padding: '10px 12px',
            color: 'var(--text-1)',
            fontSize: '14px',
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            style={{ width: '28px', height: '28px', marginRight: '4px' }}
          >
            <X size={14} style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
          <button
            type="button"
            onClick={() => searchLocation()}
            disabled={loading || !query.trim()}
            className="flex items-center justify-center rounded-[18px] transition-all flex-shrink-0"
            style={{
              background: query.trim() ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)',
              color: query.trim() ? 'var(--green)' : 'var(--text-muted)',
              border: `1px solid ${query.trim() ? 'rgba(74,222,128,0.2)' : 'transparent'}`,
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 'bold',
              minWidth: '80px',
            }}
          >
            {loading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ display: 'flex' }}>
                <Loader2 size={16} />
              </motion.div>
            ) : 'Найти'}
          </button>
        </div>

      <AnimatePresence>
        {isOpen && (results.length > 0 || loading) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-3 rounded-[24px] overflow-hidden"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-md)',
              backdropFilter: 'blur(20px)',
              boxShadow: 'var(--shadow-float)',
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center p-8 gap-3" style={{ color: 'var(--text-muted)' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ display: 'flex' }}>
                  <Loader2 size={18} />
                </motion.div>
                <span className="text-sm font-medium">Поиск...</span>
              </div>
            ) : (
              <div style={{ padding: '8px' }}>
                {results.map((result, index) => {
                  const parts = result.display_name.split(', ');
                  const mainName = parts[0];
                  const subName = parts.slice(1).join(', ');

                  return (
                    <button
                      key={result.place_id || index}
                      onClick={() => handleSelect(result)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 14,
                        padding: '12px 16px', width: '100%', textAlign: 'left',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        borderRadius: 16, transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,222,128,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ marginTop: 2, flexShrink: 0, color: 'var(--green)' }}>
                        <MapPin size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {mainName}
                        </p>
                        {subName && (
                          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3 }}>
                            {subName}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
