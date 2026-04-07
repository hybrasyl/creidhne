import React from 'react';
import ReactDOM from 'react-dom';
import './assets/main.css';
import { RecoilRoot } from 'recoil';
import App from './App';

ReactDOM.render(
  <RecoilRoot>
    <App />
  </RecoilRoot>,
  document.getElementById('root')
);
