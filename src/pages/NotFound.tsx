import { Link } from 'react-router-dom';
import { Drama } from 'lucide-react';
import { Empty } from '../components/ui';

export default function NotFound() {
  return (
    <div className="card" style={{ marginTop: 40 }}>
      <Empty icon={<Drama size={48} />} title="Pərdə bağlıdır — səhifə tapılmadı" text="Axtardığınız səhifə mövcud deyil və ya köçürülüb."
        action={<Link className="btn btn-primary" to="/">İdarə panelinə qayıt</Link>} />
    </div>
  );
}
