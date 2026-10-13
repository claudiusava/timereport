import { Injectable, inject } from '@angular/core';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';

import { AuthService } from '../core/auth.service';
import { db, llamar, storage } from '../core/firebase';
import { EntradaAuditoria } from './modelos';

export interface AjustesEmpresa {
  nombreApp?: string;
  colorPrimario?: string;
  logoPath?: string;
  radioFichajeM?: number;
  maxFichajesDia?: number;
}

/** Ajustes de la empresa y auditoria (solo admin). */
@Injectable({ providedIn: 'root' })
export class EmpresaAdminService {
  private readonly auth = inject(AuthService);

  guardar(ajustes: AjustesEmpresa) {
    return llamar('actualizarEmpresa', ajustes);
  }

  /** Sube el logo (PNG, JPG o WebP, hasta 1 MB) y devuelve su ruta. */
  async subirLogo(archivo: File): Promise<string> {
    const tipos: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
    const ext = tipos[archivo.type];
    if (!ext) throw new Error('El logo tiene que ser PNG, JPG o WebP.');
    if (archivo.size > 1024 * 1024) throw new Error('El logo no puede pesar más de 1 MB.');
    const path = `clientes/${this.auth.requerirSesion().clienteId}/branding/logo-${Date.now()}.${ext}`;
    await uploadBytes(ref(storage, path), archivo, { contentType: archivo.type });
    return path;
  }

  async auditoria(max = 100): Promise<EntradaAuditoria[]> {
    const snap = await getDocs(
      query(collection(db, 'clientes', this.auth.requerirSesion().clienteId, 'auditoria'), orderBy('fecha', 'desc'), limit(max)),
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EntradaAuditoria);
  }
}
