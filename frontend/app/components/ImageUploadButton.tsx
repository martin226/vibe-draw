import React, { useState } from 'react';
import { useEditor, useToasts } from '@tldraw/tldraw';
import { vibe3DCode } from '../lib/vibe3DCode';

export function ImageUploadButton() {
  const [images, setImages] = useState<File[]>([]);
  const editor = useEditor();
  const { addToast } = useToasts();

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newImages = Array.from(files);
      setImages((prevImages) => [...prevImages, ...newImages]);
    }
  };

  const handleConvertTo3D = async () => {
    if (images.length < 2) {
      addToast({
        icon: 'cross-2',
        title: 'Upload at least two images',
        description: 'Please upload at least two images to convert to 3D.',
      });
      return;
    }

    try {
      for (const image of images) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const dataUrl = e.target?.result as string;
          await vibe3DCode(editor, null, false, dataUrl);
        };
        reader.readAsDataURL(image);
      }
      addToast({
        icon: 'check',
        title: 'Success!',
        description: 'Images converted to 3D models successfully.',
      });
    } catch (error) {
      console.error('Error converting images to 3D:', error);
      addToast({
        icon: 'cross-2',
        title: 'Error',
        description: 'Failed to convert images to 3D models.',
      });
    }
  };

  return (
    <div>
      <input type="file" accept="image/*" multiple onChange={handleImageUpload} />
      <button onClick={handleConvertTo3D}>Convert to 3D</button>
      <div>
        {images.map((image, index) => (
          <div key={index}>{image.name}</div>
        ))}
      </div>
    </div>
  );
}
