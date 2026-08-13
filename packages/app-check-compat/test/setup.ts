import './polyfills';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import { restore } from 'sinon';

chai.use(sinonChai.default || sinonChai);
chai.use(chaiAsPromised.default || chaiAsPromised);

afterEach(() => {
  restore();
});

