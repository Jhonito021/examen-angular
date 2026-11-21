import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faArrowRightFromBracket,
  faBox,
  faChartLine,
  faCircleExclamation,
  faGaugeHigh,
  faReceipt,
  faTruck,
  faUser,
  faUsers,
  faGear,
} from '@fortawesome/free-solid-svg-icons';
import { AuthService } from '../../auth';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, FontAwesomeModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly icons = {
    gauge: faGaugeHigh,
    orders: faReceipt,
    clients: faUsers,
    deliverers: faTruck,
    parcels: faBox,
    incidents: faCircleExclamation,
    proofs: faChartLine,
    statistics: faChartLine,
    settings: faGear,
    logout: faArrowRightFromBracket,
    user: faUser,
  };

  @Input() mobileOpen = false;
  @Output() navigate = new EventEmitter<void>();

  protected logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  protected onNavigate(): void {
    this.navigate.emit();
  }
}
