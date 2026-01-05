// C:\Users\jlfor\Documents\WebApplication\landlord\src\components\properties\PropertyHeader.tsx
import Link from "next/link";

type PropertyHeaderProperty = {
  id: string;
  nickname: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
  photoUrl?: string | null;
};

type Kpi = {
  label: string;
  value: string;
  className?: string; // let caller pass ll_pos/ll_neg if desired
};

export default function PropertyHeader(props: {
  property: PropertyHeaderProperty;
  href: string;
  subtitle?: string;
  kpis?: Kpi[];
  actions?: React.ReactNode;
}) {
  const { property, href, subtitle, kpis, actions } = props;

  const title = (property.nickname ?? "").trim() || property.street;
  const addressLine = `${property.street}, ${property.city}, ${property.state} ${property.zip}`;

  return (
    <div className="ll_card">
      <div className="ll_row ll_gap_md">
        <Link href={href} className="ll_header_link ll_property_header">
          <div className="ll_property_photo">
            {property.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={property.photoUrl}
                alt={title}
                className="ll_property_photo_img"
              />
            ) : (
              <div className="ll_property_photo_fallback" aria-hidden="true" />
            )}
          </div>

          <div className="ll_property_meta">
            <div className="ll_property_title_row">
              <div className="ll_property_title">{title}</div>
              {subtitle ? <div className="ll_pill">{subtitle}</div> : null}
            </div>
            <div className="ll_property_subtitle">{addressLine}</div>
          </div>
        </Link>

        <div className="ll_spacer" />
        {actions ? <div className="ll_row ll_gap_sm">{actions}</div> : null}
      </div>

      {kpis && kpis.length ? (
        <div className="ll_kpi_row">
          {kpis.map((k) => (
            <div key={k.label} className="ll_kpi_card">
              <div className="ll_kpi_label">{k.label}</div>
              <div className={`ll_kpi_value ${k.className ?? ""}`.trim()}>{k.value}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
