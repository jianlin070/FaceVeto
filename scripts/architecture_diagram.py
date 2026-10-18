"""Render the FaceVeto architecture diagram to docs/architecture.png.

Needs Graphviz (`brew install graphviz`) and `pip install diagrams`.
Solid lines are live in the deployed prototype; dashed lines are the production roadmap.
"""
from pathlib import Path

from diagrams import Cluster, Diagram, Edge
from diagrams.firebase.develop import Authentication, Hosting
from diagrams.gcp.analytics import BigQuery, PubSub
from diagrams.gcp.compute import Run
from diagrams.gcp.database import Firestore
from diagrams.gcp.devtools import GCR, Build
from diagrams.gcp.ml import AIPlatform, VertexAI
from diagrams.gcp.network import Armor
from diagrams.gcp.operations import Logging, Monitoring
from diagrams.gcp.security import KMS, Iam
from diagrams.gcp.storage import GCS
from diagrams.onprem.client import User, Users
from diagrams.onprem.vcs import Github
from diagrams.programming.framework import FastAPI, React
from diagrams.programming.language import Python

OUT = Path(__file__).resolve().parents[1] / "docs" / "architecture"

BLUE, GREEN, RED, AMBER, PURPLE, GREY = "#1a73e8", "#188038", "#d93025", "#e37400", "#9334e6", "#5f6368"


def cluster(color: str, bg: str) -> dict:
    return {"bgcolor": bg, "pencolor": color, "penwidth": "2", "fontsize": "15", "fontname": "Helvetica Bold",
            "fontcolor": color, "style": "rounded", "margin": "18"}


def edge(color: str, label: str = "", dashed: bool = False) -> Edge:
    return Edge(color=color, label=label, fontcolor=color, fontsize="12", fontname="Helvetica",
                style="dashed" if dashed else "bold", penwidth="1.6")


graph = {
    "fontname": "Helvetica Bold", "fontsize": "26", "labelloc": "t", "pad": "0.6", "nodesep": "0.7",
    "ranksep": "0.9", "splines": "spline", "bgcolor": "white",
    "label": "FaceVeto on Google Cloud: your face, your veto\n"
             "solid = live in the prototype   ·   dashed = production roadmap\n ",
}
node = {"fontname": "Helvetica", "fontsize": "12"}

with Diagram("", filename=str(OUT), outformat="png", show=False, direction="LR", graph_attr=graph, node_attr=node):
    with Cluster("People", graph_attr=cluster(GREY, "#f8f9fa")):
        owner = User("Protected person\n(enrols face, decides)")
        poster = Users("Poster")
        admin = User("Trust & safety\nreviewer")

    with Cluster("Lepak web app (phone first)", graph_attr=cluster(BLUE, "#e8f0fe")):
        web = React("React + Vite\nMediaPipe liveness (blink + head turn)\nlive alerts via Firestore listener")

    with Cluster("Firebase", graph_attr=cluster(AMBER, "#fef7e0")):
        hosting = Hosting("Firebase Hosting\n/api/** rewrite")
        auth = Authentication("Firebase Auth\nemail + Google")

    with Cluster("Google Cloud  ·  faceveto-2026  ·  asia-southeast1", graph_attr=cluster(BLUE, "#ffffff")):
        with Cluster("Cloud Run: faceveto-api", graph_attr=cluster(BLUE, "#e8f0fe")):
            run = Run("Cloud Run\nmin 1 instance, CPU boost")
            api = FastAPI("FastAPI\nenrolment · scan · cases · admin\nversioned policy engine")
            face = Python("InsightFace ArcFace\n512-d embeddings\n(baked into image)")
            agent = AIPlatform("Google ADK agent\ntools: signals, assess,\nhold, publish")

        with Cluster("Vertex AI", graph_attr=cluster(PURPLE, "#f3e8fd")):
            gemini = VertexAI("Gemini 3.6 Flash\nstructured harm assessment\nlocalised alerts · evidence pack")

        with Cluster("Data", graph_attr=cluster(GREEN, "#e6f4ea")):
            vectors = Firestore("Firestore vector search\nface templates (cosine, 1:N)")
            store = Firestore("Firestore\nusers · posts · cases · audit log\nalerts pushed live to the owner")
            media = GCS("Cloud Storage\nposts/ + quarantine/\n30 day auto delete")

        with Cluster("Operations", graph_attr=cluster(GREY, "#f1f3f4")):
            logs = Logging("Cloud Logging\nstructured JSON\n(no faces, tokens, images)")
            bq = BigQuery("BigQuery\ntrust & safety analytics")
            uptime = Monitoring("Cloud Monitoring\nuptime check on /api/healthz")

        with Cluster("Delivery & identity", graph_attr=cluster(GREY, "#f1f3f4")):
            build = Build("Cloud Build")
            registry = GCR("Artifact Registry\ndeploys Cloud Run, keeps latest 5")
            iam = Iam("IAM + Workload\nIdentity Federation\n(keyless)")

        with Cluster("Production roadmap", graph_attr={**cluster(RED, "#fce8e6"), "style": "rounded,dashed"}):
            pubsub = PubSub("Pub/Sub\nasync scans")
            kms = KMS("Cloud KMS\nCMEK for templates")
            armor = Armor("Cloud Armor\nWAF + rate limits at the edge")

    github = Github("GitHub\njianlin070/FaceVeto")

    owner >> edge(BLUE, "enrol face") >> web
    poster >> edge(BLUE, "post photo + caption") >> web
    admin >> edge(BLUE, "review console") >> web
    web >> edge(AMBER, "sign in") >> auth
    web >> edge(AMBER, "HTTPS") >> hosting >> edge(BLUE, "/api/**") >> run >> api

    api >> edge(BLUE, "detect + embed") >> face
    api >> edge(GREEN, "1:N match") >> vectors
    api >> edge(PURPLE, "protected face,\nnot the poster") >> agent >> edge(PURPLE, "image + caption\n(no identity)") >> gemini
    api >> edge(GREEN, "hold / publish\ncases, audit") >> store
    api >> edge(GREEN, "images") >> media

    api >> edge(GREY, "logs") >> logs >> edge(GREY, "log sink") >> bq

    github >> edge(GREY, "CI/CD (paused)", dashed=True) >> iam >> edge(GREY, dashed=True) >> build
    build >> edge(GREY, "container") >> registry

    api >> edge(RED, dashed=True) >> pubsub
    vectors >> edge(RED, dashed=True) >> kms
