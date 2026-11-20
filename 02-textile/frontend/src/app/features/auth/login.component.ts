import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <main class="grid min-h-screen bg-slate-100 lg:grid-cols-[1.08fr_0.92fr]">
      <section
        class="relative hidden overflow-hidden bg-gradient-to-br from-blue-950 via-blue-800 to-cyan-600 p-12 text-white lg:flex lg:flex-col lg:justify-between"
      >
        <div
          class="absolute -left-24 -top-24 size-80 rounded-full border-[48px] border-white/5"
        ></div>
        <div
          class="absolute bottom-16 right-10 size-56 rounded-full border-[40px] border-cyan-300/10"
        ></div>
        <div class="relative flex items-center gap-3">
          <span
            class="grid size-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur"
          >
            <i class="fa-solid fa-layer-group text-xl"></i>
          </span>
          <div>
            <p class="font-extrabold">Atelier Textile</p>
            <p class="mt-1 text-xs text-blue-100">Gestion de production</p>
          </div>
        </div>
        <div class="relative max-w-xl">
          <p class="mb-5 text-xs font-extrabold uppercase tracking-[0.22em] text-cyan-200">
            Plateforme métier
          </p>
          <h1 class="text-5xl font-extrabold leading-[1.08] tracking-tight">
            Pilotez chaque étape de la fabrication.
          </h1>
          <p class="mt-6 max-w-lg text-base leading-7 text-blue-100">
            Suivez les commandes, la production, les contrôles qualité et les livraisons depuis un
            espace unique.
          </p>
          <div class="mt-8 flex gap-3">
            <span class="grid size-11 place-items-center rounded-xl bg-white/10"
              ><i class="fa-solid fa-shirt"></i
            ></span>
            <span class="grid size-11 place-items-center rounded-xl bg-white/10"
              ><i class="fa-solid fa-industry"></i
            ></span>
            <span class="grid size-11 place-items-center rounded-xl bg-white/10"
              ><i class="fa-solid fa-truck-fast"></i
            ></span>
          </div>
        </div>
        <p class="relative text-xs text-blue-200">Tableau de bord sécurisé · Atelier Textile</p>
      </section>

      <section class="grid place-items-center px-5 py-10 sm:px-10">
        <div class="w-full max-w-md">
          <div class="mb-8 lg:hidden">
            <span
              class="grid size-12 place-items-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-900/20"
              ><i class="fa-solid fa-layer-group"></i
            ></span>
          </div>
          <p class="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-700">Connexion</p>
          <h2 class="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">Bienvenue</h2>
          <p class="mt-2 text-sm leading-6 text-slate-500">
            Accédez à votre espace Atelier Textile.
          </p>

          <form class="mt-8 space-y-5" [formGroup]="form" (ngSubmit)="submit()">
            <label class="field-label">
              Identifiant
              <span class="relative mt-2 block">
                <i
                  class="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400"
                ></i>
                <input
                  class="form-input pl-11"
                  formControlName="username"
                  autocomplete="username"
                  placeholder="Votre identifiant"
                  required
                />
              </span>
            </label>
            <label class="field-label">
              Mot de passe
              <span class="relative mt-2 block">
                <i
                  class="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400"
                ></i>
                <input
                  class="form-input pl-11"
                  formControlName="password"
                  type="password"
                  autocomplete="current-password"
                  placeholder="Votre mot de passe"
                  required
                />
              </span>
            </label>
            @if (error()) {
              <p
                class="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                role="alert"
              >
                <i class="fa-solid fa-circle-exclamation"></i>{{ error() }}
              </p>
            }
            <button class="primary-button w-full" type="submit" [disabled]="form.invalid || busy()">
              @if (busy()) {
                <i class="fa-solid fa-spinner fa-spin"></i>
              } @else {
                <i class="fa-solid fa-arrow-right-to-bracket"></i>
              }
              {{ busy() ? 'Vérification…' : 'Se connecter' }}
            </button>
          </form>

          <div
            class="mt-8 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500 shadow-sm"
          >
            <i class="fa-solid fa-shield-halved text-blue-600"></i>
            <span>Accès authentifié. Vos identifiants restent protégés.</span>
          </div>
        </div>
      </section>
    </main>
  `,
})
export class LoginComponent {
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  submit(): void {
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    const { username, password } = this.form.getRawValue();
    this.auth.login(username.trim(), password).subscribe({
      next: () => {
        const requested = this.route.snapshot.queryParamMap.get('returnUrl');
        const returnUrl =
          requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/dashboard';
        void this.router.navigateByUrl(returnUrl);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(
          error instanceof HttpErrorResponse && error.status === 401
            ? 'Identifiant ou mot de passe incorrect.'
            : 'Connexion impossible. Vérifiez que le serveur est disponible.',
        );
      },
      complete: () => this.busy.set(false),
    });
  }
}
