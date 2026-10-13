import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { DEMO } from '../login/demo';

/** Portada publica: presenta el producto y da acceso a la demo y a los clientes. */
@Component({
  selector: 'app-portada',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './portada.html',
  styleUrl: './portada.scss',
})
export class Portada {
  readonly demo = DEMO.id;
  readonly ventajas = [
    { icono: 'schedule', titulo: 'Fichaje desde el móvil', texto: 'Entrada y salida en un toque, comprobando por GPS que el trabajador está en la comunidad. La hora la pone el servidor.' },
    { icono: 'water_drop', titulo: 'Control del agua', texto: 'Cloro, pH, bañistas, rebosadero y agua depurada con foto, avisando de los valores fuera de rango.' },
    { icono: 'gavel', titulo: 'Registro de jornada legal', texto: 'Los fichajes no se pueden borrar ni modificar: las correcciones llevan motivo y quedan auditadas.' },
    { icono: 'table_view', titulo: 'Informes en Excel', texto: 'Fichajes, horas por trabajador y día, y controles de agua de cualquier periodo, listos para la gestoría.' },
    { icono: 'apartment', titulo: 'Comunidades y equipos', texto: 'Asigna cada trabajador a sus comunidades. Roles de administrador, socorrista y maquinista.' },
    { icono: 'palette', titulo: 'Con tu marca', texto: 'Tu logo y tus colores en la app. Tus datos, separados de los de cualquier otra empresa.' },
  ];
}
