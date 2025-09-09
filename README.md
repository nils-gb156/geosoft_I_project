# Fahrradtouren-Webanwendung

Dieses Projekt ist eine Webanwendung zur Planung und Verwaltung von Fahrradtouren und Stationen.  
Sie wurde im Rahmen eines universitären Lehrprojekts am Institut für Geoinformatik der Universität Münster entwickelt.

## Features

- **Stationen verwalten:**  
  Neue Stationen können bequem per GeoJSON-Upload, direkt auf der Karte oder per GeoJSON-Texteingabe angelegt werden. Zusätzlich können Stationen auch per Adresssuche über Geokodierung angelegt werden. Jede Station enthält einen Namen, eine Beschreibung und optional eine URL. Wird eine Wikipedia-URL angegeben, ersetzt die Webseite die Beschreibung automatisch mit dem ersten Satz des Artikels. Alle Stationen werden in einer Tabelle dargestellt und können dort editiert oder gelöscht werden. Zudem können Stationen auf der Karte angezeigt und bei Bedarf zusätzlich als GeoJSON-Datei heruntergeladen werden.

- **Touren planen:**  
  Aus den vorhandenen Stationen können individuelle Fahrradtouren zusammengestellt werden. Wähle dafür die gewünschten Stationen in der Übersicht in der passenden Reihenfolge aus. Optional lässt sich eine Rundtour planen, bei der Start- und Endpunkt identisch sind. Für jede Tour wird automatisch eine Route über Fahrradwege oder Straßen berechnet, die mit einem Namen gespeichert werden kann. Die komplette Tour mit Route und Stationen wird anschaulich auf der Karte dargestellt. Für jeden Abschnitt zwischen zwei Stationen wird zusätzlich die Streckenlänge angezeigt. Auch Touren können jederzeit in einer Liste bearbeitet oder gelöscht werden.

- **Export & Übersicht:**  
  Stationen und Touren können als GeoJSON-Datei heruntergeladen werden.  
  Alle Daten werden dauerhaft gespeichert und sind nach einem Neustart wieder verfügbar.

- **Responsives Design:**  
  Die Anwendung ist für PC, Tablet und Smartphone optimiert.


## Installation & Start (Docker)

1. Repository klonen oder herunterladen.
2. Stelle sicher, dass [Docker](https://www.docker.com/) installiert ist.
3. Im Projektordner den Container bauen und starten:
    Beim ersten Mal den ganzen Container bauen:
    ```
    docker-compose up --build
    ```
    Ansonsten nur die Anwendung starten:
    ```
    docker-compose up -d
    ```
4. Die Anwendung stoppen:
    ```
    docker-compose down
    ```
5. Datenbank leeren:
    ```
    docker-compose down -v
    ```
6. Logs der Anwendung anzeigen:
    ```
    docker-compose logs
    ```
7. Die Webseite ist erreichbar unter:  
   [http://localhost:4000](http://localhost:4000)

**Hinweis:**  
- Die MongoDB-Datenbank ist unter dem Port `27017` erreichbar.  
- Das Administrations-Interface [mongo-express](https://github.com/mongo-express/mongo-express) findest du unter [http://localhost:8085](http://localhost:8085).  
  Standard-Zugangsdaten: Benutzername `admin`, Passwort `pass`.

## Verzeichnisstruktur

- `/public` – Enthält alle statischen Dateien wie HTML, CSS, JavaScript und Bilder
- `/db` – Beinhaltet die Konfigurationsdatei für die MongoDB-Anbindung.
- `/routes` – Enthält die serverseitigen Routen für HTTP-GET- und POST-Anfragen an die MongoDB.

## Rechtliches

- Siehe [Impressum](public/impressum.html) und [Datenschutzhinweise](public/datenschutz.html) für weitere Informationen.

---

© 2025 Universität Münster – Institut für Geoinformatik