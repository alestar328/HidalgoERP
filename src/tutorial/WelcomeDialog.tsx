import { Button, Dialog } from '@ui5/webcomponents-react';
import { APP } from '../config/app';
import { WELCOME_GUIDE_ID } from './guides';
import { useTutorial } from './TutorialProvider';

/** La primera vez que se entra al inicio, ofrece el recorrido de bienvenida. */
export function WelcomeDialog() {
  const { progress, running, start, dismissWelcome } = useTutorial();
  const open = !progress.welcomeSeen && !running;

  return (
    <Dialog
      open={open}
      headerText={`Bienvenido a ${APP.name}`}
      onClose={() => {
        if (!progress.welcomeSeen) dismissWelcome();
      }}
      footer={
        <div className="dialog-footer">
          <Button design="Transparent" onClick={dismissWelcome}>
            Ahora no
          </Button>
          <Button design="Emphasized" icon="media-play" onClick={() => start(WELCOME_GUIDE_ID)}>
            Ver recorrido
          </Button>
        </div>
      }
    >
      <div className="dialog-body">
        <p>¿Te mostramos cómo usar la app? Es un recorrido de un minuto, paso a paso.</p>
        <p className="muted">
          Cuando quieras repetirlo, o aprender a hacer algo en particular, toca el botón de ayuda (?) arriba de cada
          pantalla o entra a «Más › Tutoriales».
        </p>
      </div>
    </Dialog>
  );
}
