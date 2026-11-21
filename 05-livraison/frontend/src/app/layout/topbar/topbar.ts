import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBars, faBell, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { AuthService } from '../../auth';

@Component({
  selector: 'app-topbar',
  imports: [FontAwesomeModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css',
})
export class Topbar {
  protected readonly auth = inject(AuthService);
  protected readonly icons = { bars: faBars, bell: faBell, search: faMagnifyingGlass };
  @Output() menuToggle = new EventEmitter<void>();

  protected toggleMenu(): void {
    this.menuToggle.emit();
  }
}
