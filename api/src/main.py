import flask
from flask_cors import CORS


if __name__ == '__main__':

    app = flask.Flask(__name__)
    CORS(app)
    tokens = []

    @app.route('/api/create', methods=['POST'])
    def create_token():
        tokens.append(flask.request.get_json())
        print(flask.request.get_json())
        return 'No Content\n'

    @app.route('/api/get', methods=['GET'])
    def get_state():
        print(tokens)
        return flask.jsonify(tokens)

    app.run(host='0.0.0.0')
