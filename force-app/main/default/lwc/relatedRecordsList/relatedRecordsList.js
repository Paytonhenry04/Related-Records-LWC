import { LightningElement, api, track } from 'lwc';
import getRelatedRecords from '@salesforce/apex/RelatedRecordsController.getRelatedRecords';

export default class RelatedRecordsList extends LightningElement {
    @api recordId;
    @api childObjectApiName;
    @api lookupFieldApiName;
    @api childRelationshipName;
    @api fieldsList;        // e.g. 'Name,ProductCode,ProductDescription'
    @api recordLimit = 2;   // Number of rows to show when collapsed (e.g. 2)

    @track tableData = [];
    @track columns = [];
    @track error;
    @track showAll = false;  // controls collapse/expand state

    connectedCallback() {
        this.buildColumns();
        this.fetchAllRelatedRecords();
    }

    get cardTitle() {
        if (this.childRelationshipName) {
            return `Related ${this.childRelationshipName.replace(/__r$/, '')}`;
        }
        return 'Related Records';
    }

    get hasRecords() {
        return Array.isArray(this.tableData) && this.tableData.length > 0;
    }

    get noRecordsNoError() {
        return !this.hasRecords && !this.error;
    }

    // If showAll is false, show only the first `recordLimit` rows;
    // otherwise show every row fetched.
    get displayedData() {
        if (!this.hasRecords) {
            return [];
        }
        return this.showAll 
            ? this.tableData 
            : this.tableData.slice(0, this.recordLimit);
    }

    get toggleLabel() {
        return this.showAll ? 'Collapse' : 'View All';
    }

    buildColumns() {
        const fields = (this.fieldsList || '')
            .split(',')
            .map(f => f.trim())
            .filter(f => f);

        if (fields.length === 0) {
            this.columns = [];
            return;
        }

        // 1) First field as a clickable link
        const firstField = fields[0];
        const firstLabel = this.humanizeLabel(firstField);
        const linkColumn = {
            label: firstLabel,
            fieldName: `${firstField}Url`,
            type: 'url',
            typeAttributes: {
                label: { fieldName: firstField }
            },
            sortable: false
            // No width specified: fixed‐mode will size based on header only
        };

        // 2) Remaining fields as plain text columns
        const otherColumns = fields.slice(1).map(f => ({
            label: this.humanizeLabel(f),
            fieldName: f,
            type: 'text',
            sortable: false
            // No width specified → fixed mode uses header width
        }));

        this.columns = [linkColumn, ...otherColumns];
    }

    fetchAllRelatedRecords() {
        if (
            !this.recordId ||
            !this.childObjectApiName ||
            !this.lookupFieldApiName ||
            !this.fieldsList
        ) {
            this.error = 'Configuration error: check childObjectApiName, lookupFieldApiName, and fieldsList.';
            this.tableData = [];
            return;
        }

        // Always fetch up to 200 records, ignoring recordLimit here.
        getRelatedRecords({
            parentId: this.recordId,
            childObjectApiName: this.childObjectApiName,
            lookupFieldApiName: this.lookupFieldApiName,
            fieldsString: this.fieldsList,
            limitSize: 200
        })
        .then(results => {
            const fields = this.fieldsList.split(',').map(f => f.trim());
            const linkField = fields[0]; // e.g. 'Name'

            // Build each row with a clickable link for the first field
            this.tableData = results.map(rec => {
                const row = { ...rec };
                row[`${linkField}Url`] = '/' + rec.Id;
                return row;
            });

            this.error = undefined;
        })
        .catch(err => {
            this.error = err.body && err.body.message 
                ? err.body.message 
                : JSON.stringify(err);
            this.tableData = [];
        });
    }

    handleToggle() {
        this.showAll = !this.showAll;
    }

    humanizeLabel(apiName) {
        return apiName
            .replace(/__c$|__r$/, '')
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }
}
