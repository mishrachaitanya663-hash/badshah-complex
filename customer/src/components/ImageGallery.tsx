import { useEffect, useState } from 'react';
import Icon from './Icon';

type Props = {
  images: string[];
  name: string;
};

export default function ImageGallery({ images, name }: Props) {
  const [selected, setSelected] = useState(0);
  const key = images.join('|');

  useEffect(() => setSelected(0), [key]);

  const current = images[selected];

  return (
    <div className="gallery">
      <div className="gallery-main">
        {current ? (
          <img src={current} alt={name} />
        ) : (
          <div className="image-placeholder large">
            <span className="placeholder-mark"><Icon name="products" size={26} /></span>
            <span>No product image yet</span>
          </div>
        )}
        {images.length > 1 && <span className="gallery-count">{selected + 1} / {images.length}</span>}
      </div>
      {images.length > 1 && (
        <div className="gallery-thumbs">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              className={index === selected ? 'thumb active' : 'thumb'}
              onClick={() => setSelected(index)}
              aria-label={`Show image ${index + 1}`}
            >
              <img src={image} alt="" />
            </button>
          ))}
        </div>
      )}
      <div className="gallery-note">
        <Icon name="shield" size={15} />
        Product imagery is added by the Badshah Complex team.
      </div>
    </div>
  );
}
