import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { EmpresaService } from './core/empresa.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  // Se instancia al arrancar para aplicar la marca recordada cuanto antes.
  protected readonly empresa = inject(EmpresaService);
}
