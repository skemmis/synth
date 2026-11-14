import './style.css';
import { Game } from './game';
import { buildUi } from './ui';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const game = new Game(canvas);
buildUi(game, document.getElementById('ui')!);
game.start();
(window as any).__game = game;
