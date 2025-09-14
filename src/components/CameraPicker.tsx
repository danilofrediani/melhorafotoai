import { useRef } from "react";

type Props = {
  // Passe sua função existente que já processa 1 arquivo (faz upload, insere no DB e chama a edge function).
  onPick: (file: File) => void;
  className?: string;
};

export default function CameraPicker({ onPick, className }: Props) {
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onPick(f);
    // limpa o input para permitir tirar outra foto
    e.currentTarget.value = "";
  };

  return (
    <div className={className ?? ""}>
      {/* inputs reais (escondidos) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"  /* abre câmera traseira no mobile */
        className="hidden"
        onChange={onChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChange}
      />

      {/* botões visíveis */}
      <div className="flex gap-3">
        <button
          type="button"
          className="rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition"
          onClick={() => cameraInputRef.current?.click()}
        >
          Tirar foto
        </button>

        <button
          type="button"
          className="rounded-xl px-4 py-2 bg-zinc-200 text-zinc-900 hover:bg-zinc-300 transition"
          onClick={() => galleryInputRef.current?.click()}
        >
          Escolher da galeria
        </button>
      </div>

      {/* dicas rápidas */}
      <p className="mt-2 text-sm text-zinc-500">
        No celular, “Tirar foto” abre a câmera. Em desktop, use “Escolher da galeria”.
      </p>
    </div>
  );
}

