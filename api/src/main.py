import flask
from flask_cors import CORS


def validate_token(token):

    return True


if __name__ == '__main__':

    app = flask.Flask(__name__)
    CORS(app)
    tokens = {}

    @app.route('/api/token', methods=['POST'])
    def create_token():

        new_token = flask.request.get_json(silent=True)
        if new_token:
            if tokens.get(new_token['id'], None):
                return flask.Response(status=409)
            if validate_token(new_token):
                tokens[new_token['id']] = new_token
                return flask.Response(status=201)
        return flask.Response(status=400)

    @app.route('/api/token', methods=['GET'])
    def get_state():

        return flask.jsonify(tokens.values())

    app.run(host='0.0.0.0')
