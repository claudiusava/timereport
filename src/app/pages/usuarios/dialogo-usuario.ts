import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatRadioModule } from '@angular/material/radio';

import { mensajeDeError } from '../../core/errores';
import { Comunidad, ROLES, Rol, Usuario } from '../../data/modelos';
import { UsuariosService } from '../../data/usuarios.service';

export interface DatosDialogoUsuario {
  usuario: Usuario | null;
  comunidades: Comunidad[];
  asignadas: string[];
  esUnoMismo: boolean;
}

const PASSWORD_MINIMA = 8;

const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

@Component({
  selector: 'app-dialogo-usuario',
  imports: [
    ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatRadioModule,
    MatListModule, MatIconModule,
  ],
  templateUrl: './dialogo-usuario.html',
  styles: `
    .roles { display: flex; flex-direction: column; margin-bottom: 16px; }
    .rol-descripcion { color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-small); margin-left: 4px; }
    .lista-comunidades { max-height: 260px; overflow-y: auto; border: 1px solid var(--mat-sys-outline-variant); border-radius: 12px; }
    .cabecera-comunidades { display: flex; justify-content: space-between; align-items: center; margin: 8px 0; font: var(--mat-sys-title-small); }
  `,
})
export class DialogoUsuario {
  readonly datos = inject<DatosDialogoUsuario>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<DialogoUsuario>);
  private readonly usuarios = inject(UsuariosService);
  readonly roles = ROLES;
  readonly minima = PASSWORD_MINIMA;
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly busqueda = signal('');
  readonly seleccion = signal(new Set(this.datos.asignadas));

  readonly form = inject(FormBuilder).nonNullable.group({
    nombre: [this.datos.usuario?.nombre ?? '', [Validators.required, Validators.maxLength(100)]],
    usuario: [this.datos.usuario?.username ?? '', [Validators.required, Validators.pattern(/^[^@\s][^@]*$/), Validators.maxLength(60)]],
    password: ['', this.datos.usuario ? [] : [Validators.required, Validators.minLength(PASSWORD_MINIMA)]],
    rol: [(this.datos.usuario?.rol ?? 'maquinista') as Rol, Validators.required],
  });
  readonly rol = toSignal(this.form.controls.rol.valueChanges, { initialValue: this.form.controls.rol.value });

  readonly comunidadesVisibles = computed(() => {
    const q = normalizar(this.busqueda());
    return q ? this.datos.comunidades.filter((c) => normalizar(`${c.nombre} ${c.codigo}`).includes(q)) : this.datos.comunidades;
  });

  constructor() {
    if (this.datos.esUnoMismo) this.form.controls.rol.disable();
  }

  alternar(id: string, marcada: boolean) {
    const s = new Set(this.seleccion());
    if (marcada) s.add(id);
    else s.delete(id);
    this.seleccion.set(s);
  }

  marcarVisibles(marcar: boolean) {
    const s = new Set(this.seleccion());
    for (const c of this.comunidadesVisibles()) {
      if (marcar) s.add(c.id);
      else s.delete(c.id);
    }
    this.seleccion.set(s);
  }

  async guardar() {
    this.error.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const datos = {
      nombre: v.nombre.trim(),
      usuario: v.usuario.trim(),
      rol: v.rol,
      // Los administradores ven todas las comunidades: no hace falta asignarlas.
      comunidades: v.rol === 'admin' ? [] : [...this.seleccion()],
    };
    this.guardando.set(true);
    try {
      if (this.datos.usuario) await this.usuarios.actualizar(this.datos.usuario.uid, datos);
      else await this.usuarios.crear({ ...datos, password: v.password });
      this.ref.close(true);
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo guardar el usuario.'));
    } finally {
      this.guardando.set(false);
    }
  }
}
